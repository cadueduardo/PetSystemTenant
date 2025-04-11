import './App.css'
import Pages from "./pages/index.jsx"
import { Toaster } from "./components/ui/toaster"
import { ThemeProvider } from "next-themes"
import { BrowserRouter } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true} storageKey="vite-ui-theme">
        <Pages />
        <Toaster />
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App 