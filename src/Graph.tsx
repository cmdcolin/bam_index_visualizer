import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { max, sum, fmt, fmt2 } from './util'
import type { BAI } from '@gmod/bam'

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute float a_value;

  uniform vec2 u_resolution;
  uniform float u_scale;
  uniform float u_offset;

  varying float v_value;

  void main() {
    vec2 pos = a_position;
    pos.x = pos.x * u_scale - u_offset;

    vec2 clipSpace = (pos / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_value = a_value;
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;

  varying float v_value;
  uniform float u_maxValue;

  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    if (h < 60.0) rgb = vec3(c, x, 0.0);
    else if (h < 120.0) rgb = vec3(x, c, 0.0);
    else if (h < 180.0) rgb = vec3(0.0, c, x);
    else if (h < 240.0) rgb = vec3(0.0, x, c);
    else if (h < 300.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
  }

  void main() {
    if (v_value < 0.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);
    } else {
      float ratio = min(v_value / u_maxValue, 1.0);
      float hue = ratio * 200.0;
      vec3 color = hsl2rgb(hue, 0.5, 0.5);
      gl_FragColor = vec4(color, 1.0);
    }
  }
`

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to create shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info ?? 'unknown'}`)
  }
  return shader
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info ?? 'unknown'}`)
  }
  return program
}

const ROW_SIZES = [1, 8, 64, 512, 4096, 32_768]

interface UniformLocations {
  resolution: WebGLUniformLocation | null
  scale: WebGLUniformLocation | null
  offset: WebGLUniformLocation | null
  maxValue: WebGLUniformLocation | null
}

export default function Graph({
  bai,
  maxVal,
  setCurrPos,
}: {
  bai: NonNullable<ReturnType<Awaited<ReturnType<BAI['parse']>>['indices']>>
  maxVal: string
  setCurrPos: (arg: [number, number]) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const linearCanvasRef = useRef<HTMLCanvasElement>(null)
  const linearOverlayRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const bufferRef = useRef<WebGLBuffer | null>(null)
  const uniformsRef = useRef<UniformLocations | null>(null)
  const vertexCountRef = useRef(0)
  const rafRef = useRef<number>(0)
  const setCurrPosTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [mouseDown, setMouseDown] = useState<number>()
  const [mouseCurrent, setMouseCurrent] = useState<number>()
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; offset: number } | null>(null)

  // Use refs for values that change frequently during interaction
  const scaleRef = useRef(1)
  const offsetRef = useRef(0)
  const widthRef = useRef(0)

  // State for display only (updated less frequently)
  const [displayState, setDisplayState] = useState({ scale: 1, offset: 0, width: 0 })

  const sizes = useMemo(() => {
    const result: Record<string, number> = {}
    for (const key of Object.keys(bai.binIndex)) {
      const val = bai.binIndex[+key]
      if (val) {
        result[key] = sum(val.map(f => f.fetchedSize()))
      }
    }
    return result
  }, [bai])

  const scalar = useMemo(
    () => (maxVal === '' ? max(Object.values(sizes)) : +maxVal),
    [maxVal, sizes],
  )

  // Calculate linear index deltas
  const linearDeltas = useMemo(() => {
    const linearIndex = bai.linearIndex
    const result: number[] = []
    for (let i = 0; i < linearIndex.length; i++) {
      const curr = linearIndex[i]
      const prev = linearIndex[i - 1]
      if (curr && prev) {
        result.push(curr.blockPosition - prev.blockPosition)
      } else if (curr) {
        result.push(curr.blockPosition)
      } else {
        result.push(0)
      }
    }
    return result
  }, [bai])

  const maxDelta = useMemo(() => max(linearDeltas), [linearDeltas])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const gl = glRef.current
    const program = programRef.current
    const uniforms = uniformsRef.current
    if (!canvas || !gl || !program || !uniforms) {
      return
    }

    const { width: cssWidth, height: cssHeight } = canvas.getBoundingClientRect()
    if (canvas.width !== cssWidth || canvas.height !== cssHeight) {
      canvas.width = cssWidth
      canvas.height = cssHeight
      gl.viewport(0, 0, cssWidth, cssHeight)
    }

    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferRef.current)

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const valueLoc = gl.getAttribLocation(program, 'a_value')

    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 12, 0)
    gl.enableVertexAttribArray(valueLoc)
    gl.vertexAttribPointer(valueLoc, 1, gl.FLOAT, false, 12, 8)

    gl.uniform2f(uniforms.resolution, cssWidth, cssHeight)
    gl.uniform1f(uniforms.scale, scaleRef.current)
    gl.uniform1f(uniforms.offset, offsetRef.current)
    gl.uniform1f(uniforms.maxValue, scalar)

    gl.drawArrays(gl.TRIANGLES, 0, vertexCountRef.current)
  }, [scalar])

  const renderLinearIndex = useCallback(() => {
    const canvas = linearCanvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)

    if (linearDeltas.length === 0 || maxDelta === 0) {
      ctx.fillStyle = '#666'
      ctx.textAlign = 'center'
      ctx.fillText('No linear index data', width / 2, height / 2)
      return
    }

    const scale = scaleRef.current
    const offset = offsetRef.current

    // The linear index covers 2^29 bp with entries every 16kb (2^14)
    // So there are up to 2^15 = 32768 entries - use this fixed value to match
    // the bin index coordinate system (bottom row has 32767 bins at same resolution)
    const MAX_LINEAR_ENTRIES = 32768
    const scaledWidth = width * scale
    const barWidth = scaledWidth / MAX_LINEAR_ENTRIES
    const viewStart = offset / scaledWidth
    const viewEnd = (offset + width) / scaledWidth
    const startIdx = Math.max(0, Math.floor(viewStart * MAX_LINEAR_ENTRIES))
    const endIdx = Math.min(linearDeltas.length, Math.ceil(viewEnd * MAX_LINEAR_ENTRIES))

    ctx.fillStyle = 'hsl(200, 70%, 50%)'

    for (let i = startIdx; i < endIdx; i++) {
      const delta = linearDeltas[i] ?? 0
      const barHeight = (delta / maxDelta) * height
      const x = i * barWidth - offset
      const y = height - barHeight

      if (x + barWidth >= 0 && x <= width) {
        if (barWidth >= 1) {
          ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight)
        } else {
          ctx.fillRect(x, y, 1, barHeight)
        }
      }
    }

    ctx.strokeStyle = '#ccc'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(width, 0)
    ctx.stroke()
  }, [linearDeltas, maxDelta])

  const renderLinearOverlay = useCallback(() => {
    const canvas = linearOverlayRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = 'black'
    ctx.textAlign = 'right'
    ctx.font = '11px system-ui'
    ctx.fillText(fmt(maxDelta, 0), width - 4, 12)
    ctx.fillText('0', width - 4, height - 4)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#666'
    ctx.fillText('bytes/16kb', 4, 12)
  }, [maxDelta])

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      render()
      renderLinearIndex()
    })
  }, [render, renderLinearIndex])

  const debouncedSetCurrPos = useCallback(() => {
    clearTimeout(setCurrPosTimeoutRef.current)
    setCurrPosTimeoutRef.current = setTimeout(() => {
      const scale = scaleRef.current
      const offset = offsetRef.current
      const width = widthRef.current
      const c = 2 ** 29 / scale
      setCurrPos([
        Math.max(0, (offset / width) * c),
        Math.max(0, ((offset + width) / width) * c),
      ])
      setDisplayState({ scale, offset, width })
    }, 100)
  }, [setCurrPos])

  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const gl = canvas.getContext('webgl', { antialias: true })
    if (!gl) {
      console.error('WebGL not supported')
      return
    }
    glRef.current = gl

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const program = createProgram(gl, vertexShader, fragmentShader)
    programRef.current = program

    // Cache uniform locations
    uniformsRef.current = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      scale: gl.getUniformLocation(program, 'u_scale'),
      offset: gl.getUniformLocation(program, 'u_offset'),
      maxValue: gl.getUniformLocation(program, 'u_maxValue'),
    }

    const buffer = gl.createBuffer()
    bufferRef.current = buffer
  }, [])

  const buildGeometry = useCallback(
    (canvasWidth: number, canvasHeight: number) => {
      const gl = glRef.current
      const buffer = bufferRef.current
      if (!gl || !buffer) {
        return
      }

      const vertices: number[] = []
      const yunit = canvasHeight / 6

      let curr = 0
      for (const [row, rowSize] of ROW_SIZES.entries()) {
        const xunit = canvasWidth / rowSize
        const xmin = Math.max(1, xunit)

        for (let i = 0; i < rowSize; i++, curr++) {
          const x = xunit * i
          const y = yunit * row
          const w = xmin
          const h = yunit

          const binSize = sizes[curr]
          const value = binSize ?? -1

          vertices.push(
            x, y, value,
            x + w, y, value,
            x, y + h, value,
            x, y + h, value,
            x + w, y, value,
            x + w, y + h, value,
          )
        }
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW,
      )
      vertexCountRef.current = vertices.length / 3
    },
    [sizes],
  )

  const renderOverlay = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)

    const gradient = ctx.createLinearGradient(0, 0, 0, 75)
    gradient.addColorStop(0, 'hsl(200,50%,50%)')
    gradient.addColorStop(1 / 5, 'hsl(160,50%,50%)')
    gradient.addColorStop(2 / 5, 'hsl(120,50%,50%)')
    gradient.addColorStop(3 / 5, 'hsl(80,50%,50%)')
    gradient.addColorStop(4 / 5, 'hsl(40,50%,50%)')
    gradient.addColorStop(1, 'hsl(0,50%,50%)')

    ctx.fillStyle = gradient
    ctx.fillRect(width - 10, 0, 10, 75)
    ctx.strokeRect(width - 10, 0, 10, 75)
    ctx.fillStyle = 'black'
    const str0 = '0'
    const str1 = fmt(scalar, 0)
    const res0 = ctx.measureText(str0)
    const res1 = ctx.measureText(str1)
    ctx.fillText(str1, width - 10 - res1.width, 10)
    ctx.fillText(str0, width - 10 - res0.width, 75)
  }, [scalar])

  // Initialize WebGL
  useEffect(() => {
    initWebGL()
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(setCurrPosTimeoutRef.current)
    }
  }, [initWebGL])

  // Build geometry when sizes change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !glRef.current) {
      return
    }
    const { width, height } = canvas.getBoundingClientRect()
    widthRef.current = width
    buildGeometry(width, height)
    scheduleRender()
    renderOverlay()
    renderLinearOverlay()
  }, [buildGeometry, scheduleRender, renderOverlay, renderLinearOverlay])

  // Handle scalar changes
  useEffect(() => {
    scheduleRender()
    renderOverlay()
  }, [scalar, scheduleRender, renderOverlay])

  // Mouse drag selection
  useEffect(() => {
    if (mouseDown) {
      function onMouseUp(event: MouseEvent) {
        if (!mouseDown) {
          return
        }
        const canvas = canvasRef.current
        if (!canvas) {
          return
        }

        const { width, left } = canvas.getBoundingClientRect()
        const minX = Math.min(mouseDown, event.clientX) - left
        const selW = Math.abs(mouseDown - event.clientX)
        const newScale = scaleRef.current * (width / selW)
        const newOffset = (offsetRef.current + minX) * (newScale / scaleRef.current)

        scaleRef.current = newScale
        offsetRef.current = newOffset

        scheduleRender()
        debouncedSetCurrPos()
        setMouseCurrent(undefined)
        setMouseDown(undefined)
      }
      function onMouseMove(event: MouseEvent) {
        setMouseCurrent(event.clientX)
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      return () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }
    }
  }, [mouseDown, scheduleRender, debouncedSetCurrPos])

  // Drag panning
  useEffect(() => {
    if (!isDragging) {
      return
    }

    function onMouseMove(event: MouseEvent) {
      if (!dragStartRef.current) {
        return
      }
      const deltaX = event.clientX - dragStartRef.current.x
      offsetRef.current = dragStartRef.current.offset - deltaX
      scheduleRender()
    }

    function onMouseUp() {
      setIsDragging(false)
      dragStartRef.current = null
      debouncedSetCurrPos()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, scheduleRender, debouncedSetCurrPos])

  // Wheel handler - attached once, uses refs
  useEffect(() => {
    const canvas = canvasRef.current
    const linearCanvas = linearCanvasRef.current
    if (!canvas) {
      return
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const { left, width: canvasWidth } = canvas!.getBoundingClientRect()
      const mouseX = event.clientX - left

      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
        const newScale = scaleRef.current * zoomFactor
        const newOffset = (offsetRef.current + mouseX) * zoomFactor - mouseX
        scaleRef.current = newScale
        offsetRef.current = newOffset
        widthRef.current = canvasWidth
      } else {
        offsetRef.current = offsetRef.current + event.deltaX
      }

      scheduleRender()
      debouncedSetCurrPos()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    linearCanvas?.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      linearCanvas?.removeEventListener('wheel', handleWheel)
    }
  }, [scheduleRender, debouncedSetCurrPos])

  // Initial width and currPos
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const { width } = canvas.getBoundingClientRect()
    widthRef.current = width
    debouncedSetCurrPos()
  }, [debouncedSetCurrPos])

  const c = 2 ** 29 / displayState.scale

  const handleCanvasMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true)
    dragStartRef.current = {
      x: event.clientX,
      offset: offsetRef.current,
    }
  }

  return (
    <div>
      <button
        onClick={() => {
          scaleRef.current = 1
          offsetRef.current = 0
          scheduleRender()
          debouncedSetCurrPos()
        }}
      >
        Reset zoom
      </button>
      <button
        onClick={() => {
          const canvas = canvasRef.current
          if (!canvas) {
            return
          }
          const oldScale = scaleRef.current
          const newScale = oldScale * 1.5
          const w2 = canvas.getBoundingClientRect().width / 2
          const newOffset = ((offsetRef.current + w2) * newScale) / oldScale - w2

          scaleRef.current = newScale
          offsetRef.current = newOffset

          scheduleRender()
          debouncedSetCurrPos()
        }}
      >
        Zoom in
      </button>
      <button
        onClick={() => {
          const canvas = canvasRef.current
          if (!canvas) {
            return
          }
          const oldScale = scaleRef.current
          const newScale = oldScale / 1.5
          const w2 = canvas.getBoundingClientRect().width / 2
          const newOffset = ((offsetRef.current + w2) * newScale) / oldScale - w2

          scaleRef.current = newScale
          offsetRef.current = newOffset

          scheduleRender()
          debouncedSetCurrPos()
        }}
      >
        Zoom out
      </button>
      <div style={{ textAlign: 'center' }}>
        {fmt2(2 ** 29 / displayState.scale)} ({fmt2((displayState.offset / displayState.width) * c)} -{' '}
        {fmt2(((displayState.offset + displayState.width) / displayState.width) * c)})
      </div>
      <div style={{ position: 'relative' }}>
        {mouseCurrent && mouseDown ? (
          <div
            style={{
              height: '100%',
              background: '#99c9',
              zIndex: 10,
              position: 'absolute',
              left: Math.min(mouseDown, mouseCurrent),
              width: Math.abs(mouseDown - mouseCurrent),
            }}
          />
        ) : null}
        <div
          className="rubberband"
          style={{ height: 10, width: '90%' }}
          onMouseDown={event => {
            setMouseDown(event.clientX)
            setMouseCurrent(event.clientX)
          }}
        />
        <div className="graph-label">Bin Index</div>
        <div style={{ position: 'relative', width: '90%', height: 200 }}>
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleCanvasMouseDown}
          />
          <canvas
            ref={overlayRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div className="graph-label">
          Linear Index Coverage
          <span className="linear-index-info">
            {linearDeltas.length.toLocaleString()} entries
          </span>
        </div>
        <div style={{ position: 'relative', width: '90%', height: 100 }}>
          <canvas
            ref={linearCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleCanvasMouseDown}
          />
          <canvas
            ref={linearOverlayRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
