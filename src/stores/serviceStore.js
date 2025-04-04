import { create } from 'zustand'
import { Service } from '@/api/entities'

const useServiceStore = create((set) => ({
  services: [],
  isLoading: false,
  error: null,
  
  fetchServices: async (params) => {
    try {
      set({ isLoading: true, error: null })
      const services = await Service.filter(params)
      set({ services, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },
  
  reset: () => {
    set({ services: [], isLoading: false, error: null })
  }
}))

export default useServiceStore 