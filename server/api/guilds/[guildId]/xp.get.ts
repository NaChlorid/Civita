import sqlite3 from 'sqlite3'

export default defineEventHandler(async (event) => {
  const guildId = getRouterParam(event, 'guildId')
  const authHeader = getHeader(event, 'authorization')
  const query = getQuery(event)
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const limit = parseInt(query.limit as string) || 25

  try {
    const db = new sqlite3.Database('./guild_settings.db')
    
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM user_xp WHERE guild_id=? ORDER BY xp DESC LIMIT ?', [guildId, limit], (err, rows) => {
        db.close()
        
        if (err) {
          reject(createError({
            statusCode: 500,
            statusMessage: 'Database error'
          }))
          return
        }

        resolve({
          data: rows || []
        })
      })
    })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error'
    })
  }
})
