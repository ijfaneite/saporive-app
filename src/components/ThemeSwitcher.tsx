"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant={theme === 'light' ? 'default' : 'outline'}
        onClick={() => setTheme("light")}
      >
        <Sun className="mr-2 h-4 w-4" />
        Claro
      </Button>
      <Button
        variant={theme === 'dark' ? 'default' : 'outline'}
        onClick={() => setTheme("dark")}
      >
        <Moon className="mr-2 h-4 w-4" />
        Oscuro
      </Button>
    </div>
  )
}
