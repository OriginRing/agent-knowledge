import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: localStorage.getItem('darkTheme') === '1',
  }),
  getters: {
    getToggleDark: (state) => state.isDark,
  },
  actions: {
    setToggleDark(theme: boolean) {
      this.isDark = theme
      localStorage.setItem('darkTheme', this.isDark ? '1' : '0')
    },
  },
})
