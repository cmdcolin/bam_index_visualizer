export function sum(arr: number[]) {
  let sum = 0
  let len = arr.length
  for (let i = 0; i < len; i++) {
    sum += arr[i]
  }
  return sum
}

export function max(arr: number[]) {
  let max = 0
  let len = arr.length
  for (let i = 0; i < len; i++) {
    max = Math.max(max, arr[i])
  }
  return max
}

export function min(arr: number[]) {
  let min = 0
  let len = arr.length
  for (let i = 0; i < len; i++) {
    min = Math.min(min, arr[i])
  }
  return min
}

export function avg(arr: number[]) {
  return sum(arr) / arr.length
}

export function median(arr: number[]) {
  if (arr.length == 0) {
    return 0
  }
  arr.sort((a, b) => a - b)
  const midpoint = Math.floor(arr.length / 2)
  return arr.length % 2 === 1
    ? arr[midpoint]
    : (arr[midpoint - 1] + arr[midpoint]) / 2
}
