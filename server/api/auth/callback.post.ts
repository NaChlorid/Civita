import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { code } = body

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Authorization code is required'
    })
  }

  try {
    // Exchange code for access token
    const tokenResponse = await $fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${getRequestURL(event).origin}/auth/callback`
      })
    })

    const { access_token } = tokenResponse

    // Get user info
    const userResponse = await $fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    // Get user guilds
    const guildsResponse = await $fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    const user = {
      id: userResponse.id,
      username: userResponse.username,
      avatar: userResponse.avatar,
      discriminator: userResponse.discriminator,
      guilds: guildsResponse
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        accessToken: access_token 
      }, 
      config.jwtSecret, 
      { expiresIn: '7d' }
    )

    return {
      data: {
        token,
        user
      }
    }
  } catch (error) {
    console.error('Discord OAuth error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Authentication failed'
    })
  }
})
