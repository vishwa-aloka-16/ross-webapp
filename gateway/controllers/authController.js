const crypto = require('crypto')
const User = require('../models/User')
const { createToken, serializeUser } = require('../services/authService')

const pendingChallenges = new Map()
const CHALLENGE_TTL_MS = 5 * 60 * 1000

function createChallenge(email) {
  const challengeId = crypto.randomUUID()
  const serverNonce = crypto.randomBytes(32).toString('base64')
  const expiresAt = Date.now() + CHALLENGE_TTL_MS
  pendingChallenges.set(challengeId, {
    email,
    serverNonce,
    expiresAt,
  })
  return {
    challengeId,
    serverNonce,
    expiresAt,
  }
}

function consumeChallenge(challengeId) {
  const entry = pendingChallenges.get(challengeId)
  if (!entry) {
    return null
  }
  pendingChallenges.delete(challengeId)
  if (entry.expiresAt < Date.now()) {
    return null
  }
  return entry
}

function buildProofMessage({ email, challengeId, serverNonce, clientNonce }) {
  return `${email}:${challengeId}:${serverNonce}:${clientNonce}`
}

function computeProof({ verifier, email, challengeId, serverNonce, clientNonce }) {
  return crypto
    .createHmac('sha256', Buffer.from(verifier, 'base64'))
    .update(buildProofMessage({ email, challengeId, serverNonce, clientNonce }))
    .digest('base64')
}

async function register(req, res) {
  const { firstName, lastName, email, firm, authSalt, authVerifier, kdfAlgorithm, kdfParams, keyVersion } = req.body

  if (!firstName || !lastName || !email || !firm || !authSalt || !authVerifier) {
    return res.status(400).json({
      error: 'First name, last name, email, firm, authSalt, and authVerifier are required.',
    })
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() })

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      })
    }

    const user = await User.create({
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      firm,
      authSalt,
      authVerifier,
      kdfAlgorithm: kdfAlgorithm || 'PBKDF2-SHA256',
      kdfParams: kdfParams || {},
      keyVersion: Number(keyVersion || 1),
    })

    return res.status(201).json({
      token: createToken(user),
      user: serializeUser(user),
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Registration failed.',
    })
  }
}

async function loginInit(req, res) {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({
      error: 'Email is required.',
    })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      })
    }

    const challenge = createChallenge(user.email)

    return res.json({
      challengeId: challenge.challengeId,
      serverNonce: challenge.serverNonce,
      authSalt: user.authSalt,
      kdfAlgorithm: user.kdfAlgorithm,
      kdfParams: user.kdfParams,
      keyVersion: user.keyVersion,
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Login initialization failed.',
    })
  }
}

async function loginFinish(req, res) {
  const { email, challengeId, clientNonce, clientProof } = req.body

  if (!email || !challengeId || !clientNonce || !clientProof) {
    return res.status(400).json({
      error: 'email, challengeId, clientNonce, and clientProof are required.',
    })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(401).json({
        error: 'Invalid authentication exchange.',
      })
    }

    const challenge = consumeChallenge(challengeId)
    if (!challenge || challenge.email !== user.email) {
      return res.status(401).json({
        error: 'Authentication challenge expired or is invalid.',
      })
    }

    const expectedProof = computeProof({
      verifier: user.authVerifier,
      email: user.email,
      challengeId,
      serverNonce: challenge.serverNonce,
      clientNonce,
    })

    const expectedBuffer = Buffer.from(expectedProof, 'base64')
    const actualBuffer = Buffer.from(clientProof, 'base64')
    if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      return res.status(401).json({
        error: 'Invalid authentication exchange.',
      })
    }

    const serverProof = computeProof({
      verifier: user.authVerifier,
      email: user.email,
      challengeId,
      serverNonce: challenge.serverNonce,
      clientNonce: `${clientNonce}:server`,
    })

    return res.json({
      token: createToken(user),
      user: serializeUser(user),
      serverProof,
      keyVersion: user.keyVersion,
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Login finish failed.',
    })
  }
}

function me(req, res) {
  return res.json({
    user: serializeUser(req.user),
  })
}

module.exports = {
  register,
  loginInit,
  loginFinish,
  me,
}
