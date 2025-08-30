import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authHeader = getHeader(event, 'authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any
    
    // Get fresh user data from Discord
    const userResponse = await $fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${decoded.accessToken}`
      }
    })

    const guildsResponse = await $fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${decoded.accessToken}`
      }
    })

    const user = {
      id: userResponse.id,
      username: userResponse.username,
      avatar: userResponse.avatar,
      discriminator: userResponse.discriminator,
      guilds: guildsResponse
    }

    return {
      data: user
    }
  } catch (error) {
    console.error('JWT verification error:', error)
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid token'
    })
  }
})
