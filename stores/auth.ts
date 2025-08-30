import { defineStore } from 'pinia'

interface User {
  id: string
  username: string
  avatar: string
  discriminator: string
  guilds: Guild[]
}

interface Guild {
  id: string
  name: string
  icon: string
  owner: boolean
  permissions: string
  features: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login() {
    const config = useRuntimeConfig()
    const clientId = config.public.discordClientId
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`)
    const scope = 'identify guilds'
    
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
  }

  async function logout() {
    user.value = null
    token.value = null
    await navigateTo('/')
  }

  async function handleCallback(code: string) {
    loading.value = true
    try {
      const { data } = await $fetch('/api/auth/callback', {
        method: 'POST',
        body: { code }
      })
      
      token.value = data.token
      user.value = data.user
      
      await navigateTo('/dashboard')
    } catch (error) {
      console.error('Auth callback error:', error)
      await navigateTo('/?error=auth_failed')
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return
    
    try {
      const { data } = await $fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      })
      user.value = data
    } catch (error) {
      console.error('Fetch user error:', error)
      await logout()
    }
  }

  return {
    user: readonly(user),
    token: readonly(token),
    loading: readonly(loading),
    isAuthenticated,
    login,
    logout,
    handleCallback,
    fetchUser
  }
})
