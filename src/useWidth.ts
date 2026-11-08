import { useEffect, useRef, useState } from 'react'

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    const observer = new ResizeObserver(entries => {
      setWidth(Math.floor(entries[0]?.contentRect.width ?? 0))
    })
    if (el) {
      observer.observe(el)
    }
    return () => {
      observer.disconnect()
    }
  }, [])
  return [ref, width] as const
}
