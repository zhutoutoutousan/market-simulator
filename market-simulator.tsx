"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart2, LineChart as LineChartIcon, Zap } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts"

interface Order {
  id: string
  type: "buy" | "sell"
  price: number
  quantity: number
  timestamp: number
}

interface Trade {
  id: string
  price: number
  quantity: number
  timestamp: number
  type: "buy" | "sell"
}

interface PricePoint {
  timestamp: number
  price: number
  volume: number
}

interface Position {
  id: string
  type: "long" | "short"
  entryPrice: number
  quantity: number
  timestamp: number
  pnl: number
}

interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export default function MarketSimulator() {
  const [currentPrice, setCurrentPrice] = useState(100)
  const [orderBook, setOrderBook] = useState<{ bids: Order[]; asks: Order[] }>({ bids: [], asks: [] })
  const [recentTrades, setRecentTrades] = useState<Trade[]>([])
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [balance, setBalance] = useState(10000)
  const [orderQuantity, setOrderQuantity] = useState(1)
  const [orderPrice, setOrderPrice] = useState(100)
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [chartType, setChartType] = useState<"line" | "candlestick">("line")
  const [timeInterval, setTimeInterval] = useState<"1m" | "5m" | "15m" | "1h" | "1d">("1m")
  const [simulationSpeed, setSimulationSpeed] = useState<1 | 2 | 3 | 5 | 10>(1)
  
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)

  // Initialize TradingView chart
  useEffect(() => {
    if (chartType === "candlestick" && chartContainerRef.current) {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#1F2937' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 384,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
          rightOffset: 5,
          barSpacing: 6,
          minBarSpacing: 2,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000)
            const intervalMs = {
              "1m": 60 * 1000,
              "5m": 5 * 60 * 1000,
              "15m": 15 * 60 * 1000,
              "1h": 60 * 60 * 1000,
              "1d": 24 * 60 * 60 * 1000,
            }[timeInterval]

            // Adjust the time display based on simulation speed
            const adjustedTime = new Date(date.getTime() / simulationSpeed)
            
            if (timeInterval === "1m") {
              return adjustedTime.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })
            } else if (timeInterval === "5m" || timeInterval === "15m") {
              return adjustedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            } else if (timeInterval === "1h") {
              return adjustedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            } else {
              return adjustedTime.toLocaleDateString([], { month: 'short', day: 'numeric' })
            }
          },
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        crosshair: {
          mode: 1, // Show crosshair on mouse move
          vertLine: {
            width: 1,
            color: '#9CA3AF',
            style: 1,
            labelBackgroundColor: '#1F2937',
          },
          horzLine: {
            width: 1,
            color: '#9CA3AF',
            style: 1,
            labelBackgroundColor: '#1F2937',
          },
        },
      })

      // @ts-ignore - The type definitions are incorrect, but the method exists
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        borderVisible: false,
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      })

      chartRef.current = chart
      candlestickSeriesRef.current = candlestickSeries

      // Add zoom controls
      const zoomIn = () => {
        const timeScale = chart.timeScale()
        const currentBarSpacing = timeScale.options().barSpacing
        timeScale.applyOptions({
          barSpacing: currentBarSpacing * 1.5,
        })
      }

      const zoomOut = () => {
        const timeScale = chart.timeScale()
        const currentBarSpacing = timeScale.options().barSpacing
        timeScale.applyOptions({
          barSpacing: currentBarSpacing / 1.5,
        })
      }

      const resetZoom = () => {
        chart.timeScale().fitContent()
      }

      // Add keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === '+') zoomIn()
        if (e.key === '-') zoomOut()
        if (e.key === 'r') resetZoom()
      }

      window.addEventListener('keydown', handleKeyDown)

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth })
        }
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('keydown', handleKeyDown)
        chart.remove()
      }
    }
  }, [chartType, timeInterval, simulationSpeed])

  // Update candlestick data on every price change
  useEffect(() => {
    if (chartType === "candlestick" && candlestickSeriesRef.current) {
      const formattedData: CandlestickData[] = candleData.map(candle => ({
        time: Math.floor(candle.timestamp / 1000) as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
      candlestickSeriesRef.current.setData(formattedData)
      
      // Fit content after setting data to show all candles
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
    }
  }, [candleData, chartType, currentPrice])

  // Initialize order book with some spread
  const initializeOrderBook = useCallback(() => {
    const bids: Order[] = []
    const asks: Order[] = []

    for (let i = 0; i < 10; i++) {
      bids.push({
        id: `bid-${i}`,
        type: "buy",
        price: currentPrice - (i + 1) * 0.5,
        quantity: Math.random() * 10 + 1,
        timestamp: Date.now(),
      })

      asks.push({
        id: `ask-${i}`,
        type: "sell",
        price: currentPrice + (i + 1) * 0.5,
        quantity: Math.random() * 10 + 1,
        timestamp: Date.now(),
      })
    }

    setOrderBook({ bids: bids.sort((a, b) => b.price - a.price), asks: asks.sort((a, b) => a.price - b.price) })
  }, [currentPrice])

  // Generate random trader activity
  const simulateTraderActivity = useCallback(() => {
    if (!isSimulationRunning) return

    const shouldTrade = Math.random() < 0.5
    if (!shouldTrade) return

    const isBuy = Math.random() < 0.5
    const isMarketOrder = Math.random() < 0.8

    if (isMarketOrder) {
      // Execute market order
      const quantity = Math.random() * 10 + 1

      if (isBuy && orderBook.asks.length > 0) {
        const bestAsk = orderBook.asks[0]
        const executedPrice = bestAsk.price

        // Update order book
        setOrderBook((prev) => {
          const newAsks = [...prev.asks]
          newAsks[0] = { ...newAsks[0], quantity: Math.max(0, newAsks[0].quantity - quantity) }
          if (newAsks[0].quantity <= 0) {
            newAsks.shift()
          }
          return { ...prev, asks: newAsks }
        })

        // Update price and add trade
        setCurrentPrice(executedPrice)
        const trade: Trade = {
          id: `trade-${Date.now()}`,
          price: executedPrice,
          quantity,
          timestamp: Date.now(),
          type: "buy",
        }
        setRecentTrades((prev) => [trade, ...prev.slice(0, 49)])
      } else if (!isBuy && orderBook.bids.length > 0) {
        const bestBid = orderBook.bids[0]
        const executedPrice = bestBid.price

        // Update order book
        setOrderBook((prev) => {
          const newBids = [...prev.bids]
          newBids[0] = { ...newBids[0], quantity: Math.max(0, newBids[0].quantity - quantity) }
          if (newBids[0].quantity <= 0) {
            newBids.shift()
          }
          return { ...prev, bids: newBids }
        })

        // Update price and add trade
        setCurrentPrice(executedPrice)
        const trade: Trade = {
          id: `trade-${Date.now()}`,
          price: executedPrice,
          quantity,
          timestamp: Date.now(),
          type: "sell",
        }
        setRecentTrades((prev) => [trade, ...prev.slice(0, 49)])
      }
    } else {
      // Add limit order to book
      const priceOffset = (Math.random() - 0.5) * 4
      const price = currentPrice + priceOffset
      const quantity = Math.random() * 5 + 1

      const order: Order = {
        id: `order-${Date.now()}-${Math.random()}`,
        type: isBuy ? "buy" : "sell",
        price,
        quantity,
        timestamp: Date.now(),
      }

      setOrderBook((prev) => {
        if (isBuy) {
          const newBids = [...prev.bids, order].sort((a, b) => b.price - a.price)
          return { ...prev, bids: newBids.slice(0, 20) }
        } else {
          const newAsks = [...prev.asks, order].sort((a, b) => a.price - b.price)
          return { ...prev, asks: newAsks.slice(0, 20) }
        }
      })
    }
  }, [isSimulationRunning, orderBook, currentPrice])

  // Update price history and candle data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const baseIntervalMs = {
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
      }[timeInterval]

      // Adjust the interval based on simulation speed
      const adjustedIntervalMs = baseIntervalMs / simulationSpeed
      const currentInterval = Math.floor(now / adjustedIntervalMs) * adjustedIntervalMs

      setPriceHistory((prev) => {
        const newPoint: PricePoint = {
          timestamp: now,
          price: currentPrice,
          volume: Math.random() * 100,
        }
        return [...prev.slice(-99), newPoint]
      })

      setCandleData((prev) => {
        // Group existing candles by the new interval
        const groupedCandles = new Map<number, CandleData>()
        
        // Process existing candles
        prev.forEach(candle => {
          const candleInterval = Math.floor(candle.timestamp / adjustedIntervalMs) * adjustedIntervalMs
          const existingCandle = groupedCandles.get(candleInterval)
          
          if (existingCandle) {
            groupedCandles.set(candleInterval, {
              timestamp: candleInterval,
              open: existingCandle.open,
              high: Math.max(existingCandle.high, candle.high),
              low: Math.min(existingCandle.low, candle.low),
              close: candle.close,
              volume: existingCandle.volume + candle.volume,
            })
          } else {
            groupedCandles.set(candleInterval, { ...candle, timestamp: candleInterval })
          }
        })

        // Add current price to the appropriate interval
        const currentCandleInterval = Math.floor(now / adjustedIntervalMs) * adjustedIntervalMs
        const existingCurrentCandle = groupedCandles.get(currentCandleInterval)
        
        if (existingCurrentCandle) {
          groupedCandles.set(currentCandleInterval, {
            timestamp: currentCandleInterval,
            open: existingCurrentCandle.open,
            high: Math.max(existingCurrentCandle.high, currentPrice),
            low: Math.min(existingCurrentCandle.low, currentPrice),
            close: currentPrice,
            volume: existingCurrentCandle.volume + Math.random() * 10,
          })
        } else {
          groupedCandles.set(currentCandleInterval, {
            timestamp: currentCandleInterval,
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: Math.random() * 100,
          })
        }

        // Convert map to array and sort by timestamp
        const newCandles = Array.from(groupedCandles.values())
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-100) // Keep last 100 candles

        return newCandles
      })
    }, 1000 / simulationSpeed) // Adjust update frequency based on simulation speed

    return () => clearInterval(interval)
  }, [currentPrice, timeInterval, simulationSpeed])

  // Simulation loop
  useEffect(() => {
    if (!isSimulationRunning) return

    const interval = setInterval(() => {
      simulateTraderActivity()

      // Refresh order book more frequently
      if (Math.random() < 0.3) {
        initializeOrderBook()
      }
    }, 300 / simulationSpeed) // Adjust interval based on simulation speed

    return () => clearInterval(interval)
  }, [isSimulationRunning, simulateTraderActivity, initializeOrderBook, simulationSpeed])

  // Initialize
  useEffect(() => {
    initializeOrderBook()
    setOrderPrice(currentPrice)
  }, [])

  // Update positions PnL
  useEffect(() => {
    setPositions((prev) =>
      prev.map((pos) => ({
        ...pos,
        pnl:
          pos.type === "long"
            ? (currentPrice - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - currentPrice) * pos.quantity,
      })),
    )
  }, [currentPrice])

  const executeMarketBuy = () => {
    if (orderBook.asks.length === 0 || balance < orderQuantity * orderBook.asks[0].price) return

    const price = orderBook.asks[0].price
    const cost = orderQuantity * price

    setBalance((prev) => prev - cost)

    const position: Position = {
      id: `pos-${Date.now()}`,
      type: "long",
      entryPrice: price,
      quantity: orderQuantity,
      timestamp: Date.now(),
      pnl: 0,
    }

    setPositions((prev) => [...prev, position])
  }

  const executeMarketSell = () => {
    if (orderBook.bids.length === 0) return

    const price = orderBook.bids[0].price
    const revenue = orderQuantity * price

    setBalance((prev) => prev + revenue)

    const position: Position = {
      id: `pos-${Date.now()}`,
      type: "short",
      entryPrice: price,
      quantity: orderQuantity,
      timestamp: Date.now(),
      pnl: 0,
    }

    setPositions((prev) => [...prev, position])
  }

  const executeBuyStop = () => {
    if (orderPrice <= currentPrice) {
      executeMarketBuy()
    }
  }

  const closePosition = (positionId: string) => {
    const position = positions.find((p) => p.id === positionId)
    if (!position) return

    const closePrice =
      position.type === "long" ? orderBook.bids[0]?.price || currentPrice : orderBook.asks[0]?.price || currentPrice

    const pnl =
      position.type === "long"
        ? (closePrice - position.entryPrice) * position.quantity
        : (position.entryPrice - closePrice) * position.quantity

    setBalance((prev) => prev + pnl + position.entryPrice * position.quantity)
    setPositions((prev) => prev.filter((p) => p.id !== positionId))
  }

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Market Simulator</h1>
          <div className="flex items-center gap-4">
            <Badge variant={totalPnL >= 0 ? "default" : "destructive"} className="text-lg px-3 py-1">
              <DollarSign className="w-4 h-4 mr-1" />
              Balance: ${balance.toFixed(2)}
            </Badge>
            <Badge variant={totalPnL >= 0 ? "default" : "destructive"} className="text-lg px-3 py-1">
              P&L: ${totalPnL.toFixed(2)}
            </Badge>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <Select value={simulationSpeed.toString()} onValueChange={(value) => setSimulationSpeed(Number(value) as 1 | 2 | 3 | 5 | 10)}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="3">3x</SelectItem>
                  <SelectItem value="5">5x</SelectItem>
                  <SelectItem value="10">10x</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setIsSimulationRunning(!isSimulationRunning)}
              variant={isSimulationRunning ? "destructive" : "default"}
            >
              <Activity className="w-4 h-4 mr-2" />
              {isSimulationRunning ? "Stop Simulation" : "Start Simulation"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Price Chart */}
          <Card className="lg:col-span-3 bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Price Chart
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={chartType === "line" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChartType("line")}
                    >
                      <LineChartIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={chartType === "candlestick" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChartType("candlestick")}
                    >
                      <BarChart2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Select value={timeInterval} onValueChange={(value: "1m" | "5m" | "15m" | "1h" | "1d") => setTimeInterval(value)}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">1m</SelectItem>
                      <SelectItem value="5m">5m</SelectItem>
                      <SelectItem value="15m">15m</SelectItem>
                      <SelectItem value="1h">1h</SelectItem>
                      <SelectItem value="1d">1d</SelectItem>
                    </SelectContent>
                  </Select>
                  {chartType === "candlestick" && (
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          const timeScale = chartRef.current?.timeScale()
                          if (timeScale) {
                            const currentBarSpacing = timeScale.options().barSpacing
                            timeScale.applyOptions({
                              barSpacing: currentBarSpacing * 1.5,
                            })
                          }
                        }}
                      >
                        +
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          const timeScale = chartRef.current?.timeScale()
                          if (timeScale) {
                            const currentBarSpacing = timeScale.options().barSpacing
                            timeScale.applyOptions({
                              barSpacing: currentBarSpacing / 1.5,
                            })
                          }
                        }}
                      >
                        -
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => chartRef.current?.timeScale().fitContent()}
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">${currentPrice.toFixed(2)}</span>
                    {priceHistory.length > 1 && (
                      <Badge
                        variant={
                          priceHistory[priceHistory.length - 1].price > priceHistory[priceHistory.length - 2].price
                            ? "default"
                            : "destructive"
                        }
                      >
                        {priceHistory[priceHistory.length - 1].price > priceHistory[priceHistory.length - 2].price ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                {chartType === "line" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        stroke="#9CA3AF"
                      />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                        contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }}
                      />
                      <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div ref={chartContainerRef} className="w-full h-full" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trading Panel */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Trading Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>

              <div className="space-y-2">
                <Label>Price (for limit/stop orders)</Label>
                <Input
                  type="number"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(Number(e.target.value))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={executeMarketBuy} className="bg-green-600 hover:bg-green-700">
                  Market Buy
                </Button>
                <Button onClick={executeMarketSell} className="bg-red-600 hover:bg-red-700">
                  Market Sell
                </Button>
                <Button onClick={executeBuyStop} variant="outline" className="border-green-600 text-green-600">
                  Buy Stop
                </Button>
                <Button variant="outline" className="border-red-600 text-red-600">
                  Sell Stop
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Order Book */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Order Book</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-2">Asks (Sell Orders)</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {orderBook.asks
                      .slice(0, 5)
                      .reverse()
                      .map((ask, index) => (
                        <div key={ask.id} className="flex justify-between text-xs">
                          <span className="text-red-400">${ask.price.toFixed(2)}</span>
                          <span>{ask.quantity.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="border-t border-gray-600 pt-2">
                  <div className="text-center text-lg font-bold">${currentPrice.toFixed(2)}</div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2">Bids (Buy Orders)</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {orderBook.bids.slice(0, 5).map((bid, index) => (
                      <div key={bid.id} className="flex justify-between text-xs">
                        <span className="text-green-400">${bid.price.toFixed(2)}</span>
                        <span>{bid.quantity.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Trades */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Recent Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {recentTrades.slice(0, 10).map((trade) => (
                  <div key={trade.id} className="flex justify-between text-xs">
                    <span className={trade.type === "buy" ? "text-green-400" : "text-red-400"}>
                      ${trade.price.toFixed(2)}
                    </span>
                    <span>{trade.quantity.toFixed(2)}</span>
                    <span className="text-gray-400">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Positions */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {positions.length === 0 ? (
                  <p className="text-gray-400 text-sm">No open positions</p>
                ) : (
                  positions.map((position) => (
                    <div key={position.id} className="border border-gray-600 rounded p-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <Badge variant={position.type === "long" ? "default" : "destructive"}>
                          {position.type.toUpperCase()}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closePosition(position.id)}
                          className="text-xs"
                        >
                          Close
                        </Button>
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Entry: ${position.entryPrice.toFixed(2)}</div>
                        <div>Qty: {position.quantity.toFixed(2)}</div>
                        <div className={`font-medium ${position.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          P&L: ${position.pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
