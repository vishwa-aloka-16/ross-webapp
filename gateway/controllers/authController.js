const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { createToken, serializeUser } = require('../services/authService')

async function register(req, res) {
  const { firstName, lastName, email, firm, password } = req.body

  if (!firstName || !lastName || !email || !firm || !password) {
    return res.status(400).json({
      error: 'First name, last name, email, firm, and password are required.',
    })
  }

  if (password.length < 10) {
    return res.status(400).json({
      error: 'Password must be at least 10 characters long.',
    })
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() })

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      firm,
      passwordHash,
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

async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required.',
    })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      })
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      })
    }

    return res.json({
      token: createToken(user),
      user: serializeUser(user),
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Login failed.',
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
  login,
  me,
}
