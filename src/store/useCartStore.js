import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  cart: [],

  addToCart: (product) => set((state) => {
    const exists = state.cart.find((item) => item.id === product.id);

    if (exists) {
      return {
        cart: state.cart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        ),
      };
    } else {
      return { cart: [...state.cart, { ...product, qty: 1 }] };
    }
  }),

  // <--- NUEVA FUNCIÓN: Restar 1 cantidad
  decrementFromCart: (productId) => set((state) => {
    const item = state.cart.find((i) => i.id === productId);
    
    // Si la cantidad es 1, lo eliminamos (o podrías dejarlo en 1, pero eliminar es más rápido)
    if (item.qty === 1) {
      return { cart: state.cart.filter((i) => i.id !== productId) };
    }

    // Si es mayor a 1, solo restamos
    return {
      cart: state.cart.map((i) =>
        i.id === productId ? { ...i, qty: i.qty - 1 } : i
      ),
    };
  }),
  // ---------------------------------------

  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter((item) => item.id !== productId),
  })),

  clearCart: () => set({ cart: [] }),

  getTotal: () => {
    const { cart } = get();
    return cart.reduce((total, item) => total + item.price_sell * item.qty, 0);
  },
}));