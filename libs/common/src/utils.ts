export const getBlockIntervals = (
  start: number,
  stop: number,
  step: number,
) => {
  const loopCnt = Math.ceil((stop - start) / step);
  const intervals = [];
  for (let i = 0; i < loopCnt; i++) {
    const fromBlock = start + i * step;
    const toBlock = Math.min(fromBlock + step, stop);
    intervals.push([fromBlock, toBlock]);
  }
  return intervals;
};

export const splitIntoChunks = <T>(array: T[], size: number): T[][] => {
  const arr: T[][] = [];
  for (let i = 0, j = array.length; i < j; i += size) {
    arr.push(array.slice(i, i + size));
  }
  return arr;
};

export const splitObjectIntoChunks = <T>(obj: T, size: number): T[] => {
  const arr: T[] = [];

  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += size) {
    const temp: T = {} as T;
    for (let j = 0; j < size; j++) {
      if (keys[i + j]) {
        temp[keys[i + j]] = obj[keys[i + j]];
      }
    }

    arr.push(temp);
  }

  return arr;
};

export const getAverage = (nums: number[]) => {
  if (nums.length === 0) {
    return 0;
  }

  if (nums.length === 1) {
    return nums[0];
  }

  const filtered = nums.filter((num) => num !== 0);
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
};

export const findNextBlock = (block: number, orderedBlocks: number[]) => {
  const index = orderedBlocks.findIndex((b) => b >= block);
  return orderedBlocks[index];
}
