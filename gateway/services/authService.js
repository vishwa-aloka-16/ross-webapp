const jwt = require('jsonwebtoken')
const { jwtSecret, jwtExpiresIn } = require('../config/env')

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  )
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email,
    firm: user.firm || '',
  }
}

module.exports = {
  createToken,
  serializeUser,
}
