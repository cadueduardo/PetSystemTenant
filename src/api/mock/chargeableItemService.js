const LOCAL_STORAGE_KEY = 'pendingCharges';

// Helper function to get all pending charges from localStorage
const getCharges = () => {
  try {
    const chargesJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    return chargesJson ? JSON.parse(chargesJson) : {};
  } catch (error) {
    console.error("Error reading pending charges from localStorage:", error);
    return {};
  }
};

// Helper function to save all pending charges to localStorage
const saveCharges = (charges) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(charges));
  } catch (error) {
    console.error("Error saving pending charges to localStorage:", error);
  }
};

// --- Public API --- //

/**
 * Gets the list of pending chargeable items for a specific appointment.
 * @param {string} appointmentId The ID of the appointment.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of item objects or an empty array if none found.
 * Item structure: { id: string, name: string, price: number, quantity: number }
 */
export const getPendingItems = async (appointmentId) => {
  console.log(`[ChargeableItemService] Getting pending items for appointment ID: ${appointmentId}`);
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 50));
  const allCharges = getCharges();
  const items = allCharges[appointmentId] || [];
  console.log(`[ChargeableItemService] Found ${items.length} pending items.`);
  return items;
};

/**
 * Adds or replaces the list of chargeable items for a specific appointment.
 * @param {string} appointmentId The ID of the appointment.
 * @param {Array<Object>} items The array of item objects to save.
 * @returns {Promise<boolean>} A promise that resolves with true on success.
 */
export const addPendingItems = async (appointmentId, items) => {
  if (!appointmentId || !Array.isArray(items)) {
    console.error('[ChargeableItemService] Invalid arguments for addPendingItems.');
    return false;
  }
  console.log(`[ChargeableItemService] Adding/Updating ${items.length} pending items for appointment ID: ${appointmentId}`);
   // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 50));
  const allCharges = getCharges();
  allCharges[appointmentId] = items; // Add or overwrite
  saveCharges(allCharges);
  return true;
};

/**
 * Clears the list of pending chargeable items for a specific appointment.
 * Should be called after the items are successfully loaded into the sales cart.
 * @param {string} appointmentId The ID of the appointment.
 * @returns {Promise<boolean>} A promise that resolves with true if items were cleared, false otherwise.
 */
export const clearPendingItems = async (appointmentId) => {
  if (!appointmentId) {
     console.error('[ChargeableItemService] appointmentId is required for clearPendingItems.');
     return false;
  }
  console.log(`[ChargeableItemService] Clearing pending items for appointment ID: ${appointmentId}`);
   // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 50));
  const allCharges = getCharges();
  let cleared = false;
  if (allCharges[appointmentId]) {
    delete allCharges[appointmentId];
    saveCharges(allCharges);
    cleared = true;
    console.log(`[ChargeableItemService] Cleared pending items.`);
  } else {
     console.warn(`[ChargeableItemService] No pending items found to clear for appointment ID: ${appointmentId}`);
  }
  return cleared;
};
