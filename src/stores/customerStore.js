import { create } from 'zustand'
import { Customer } from '@/api/entities'

const useCustomerStore = create((set) => ({
  customers: [],
  isLoading: false,
  error: null,
  
  fetchCustomers: async (params) => {
    try {
      set({ isLoading: true, error: null })
      const customers = await Customer.filter(params)
      set({ customers, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },
  
  reset: () => {
    set({ customers: [], isLoading: false, error: null })
  }
}))

export default useCustomerStore 