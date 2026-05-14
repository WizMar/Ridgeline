import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'

export type SignatureCanvasRef = {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

const SignatureCanvas = forwardRef<SignatureCanvasRef, { className?: string }>(
  ({ className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const hasDrawn = useRef(false)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = '#e4e4e7'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }, [])

    function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
      const rect = canvas.getBoundingClientRect()
      const src = 'touches' in e ? e.touches[0] : (e as MouseEvent)
      return { x: src.clientX - rect.left, y: src.clientY - rect.top }
    }

    function onStart(e: React.MouseEvent | React.TouchEvent) {
      const canvas = canvasRef.current
      if (!canvas) return
      e.preventDefault()
      drawing.current = true
      hasDrawn.current = true
      const ctx = canvas.getContext('2d')!
      const { x, y } = getPos(e.nativeEvent, canvas)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }

    function onMove(e: React.MouseEvent | React.TouchEvent) {
      if (!drawing.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      e.preventDefault()
      const ctx = canvas.getContext('2d')!
      const { x, y } = getPos(e.nativeEvent, canvas)
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    function onEnd() {
      drawing.current = false
    }

    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        hasDrawn.current = false
      },
      isEmpty: () => !hasDrawn.current,
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
    }))

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ touchAction: 'none' }}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      />
    )
  }
)

SignatureCanvas.displayName = 'SignatureCanvas'
export default SignatureCanvas
