import { defineStore } from 'pinia'

interface GuildSettings {
  guild_id: string
  welcome_channel_id: string | null
  leave_channel_id: string | null
  qotd_channel_id: string | null
  report_log_channel_id: string | null
  moderation_enabled: boolean
  ai_enabled: boolean
}

interface ProfanitySettings {
  guild_id: string
  added_words: string[]
  use_default: boolean
}

interface UserXP {
  guild_id: string
  user_id: string
  xp: number
  level: number
  username?: string
  avatar?: string
}

interface GuildChannel {
  id: string
  name: string
  type: number
}

export const useBotStore = defineStore('bot', () => {
  const selectedGuild = ref<string | null>(null)
  const guildSettings = ref<GuildSettings | null>(null)
  const profanitySettings = ref<ProfanitySettings | null>(null)
  const userXP = ref<UserXP[]>([])
  const channels = ref<GuildChannel[]>([])
  const loading = ref(false)

  const authStore = useAuthStore()

  async function fetchGuildSettings(guildId: string) {
    if (!authStore.token) return
    
    loading.value = true
    try {
      const { data } = await $fetch(`/api/guilds/${guildId}/settings`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      guildSettings.value = data
    } catch (error) {
      console.error('Fetch guild settings error:', error)
    } finally {
      loading.value = false
    }
  }

  async function updateGuildSetting(guildId: string, setting: string, value: any) {
    if (!authStore.token) return
    
    try {
      const { data } = await $fetch(`/api/guilds/${guildId}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        body: { setting, value }
      })
      guildSettings.value = data
      return data
    } catch (error) {
      console.error('Update guild setting error:', error)
      throw error
    }
  }

  async function fetchProfanitySettings(guildId: string) {
    if (!authStore.token) return
    
    try {
      const { data } = await $fetch(`/api/guilds/${guildId}/profanity`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      profanitySettings.value = data
    } catch (error) {
      console.error('Fetch profanity settings error:', error)
    }
  }

  async function updateProfanitySettings(guildId: string, settings: Partial<ProfanitySettings>) {
    if (!authStore.token) return
    
    try {
      const { data } = await $fetch(`/api/guilds/${guildId}/profanity`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        body: settings
      })
      profanitySettings.value = data
      return data
    } catch (error) {
      console.error('Update profanity settings error:', error)
      throw error
    }
  }

  async function fetchUserXP(guildId: string, limit = 25) {
    if (!authStore.token) return
    
    try {
      const { data } = await $fetch(`/api/guilds/${guildId}/xp?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      userXP.value = data
    } catch (error) {
      console.error('Fetch user XP error:', error)
    }
  }

  async function fetchChannels(guildId: string) {
    if (!authStore.token) return
    
    try {
      const { data } = await $fetch(`/api/guilds/${guildId}/channels`, {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      channels.value = data
    } catch (error) {
      console.error('Fetch channels error:', error)
    }
  }

  async function forceQOTD(guildId: string) {
    if (!authStore.token) return
    
    try {
      await $fetch(`/api/guilds/${guildId}/qotd`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
    } catch (error) {
      console.error('Force QOTD error:', error)
      throw error
    }
  }

  function selectGuild(guildId: string) {
    selectedGuild.value = guildId
    fetchGuildSettings(guildId)
    fetchProfanitySettings(guildId)
    fetchChannels(guildId)
  }

  return {
    selectedGuild: readonly(selectedGuild),
    guildSettings: readonly(guildSettings),
    profanitySettings: readonly(profanitySettings),
    userXP: readonly(userXP),
    channels: readonly(channels),
    loading: readonly(loading),
    fetchGuildSettings,
    updateGuildSetting,
    fetchProfanitySettings,
    updateProfanitySettings,
    fetchUserXP,
    fetchChannels,
    forceQOTD,
    selectGuild
  }
})
