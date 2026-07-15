function test(arr, target) {
  const _data = arr.filter((n) => n <= target);
  _data.sort((n1, n2) => n2 - n1);
  const result = [[]];
  for (const n of _data) {
    let isAdd = false;
    for (const l of result) {
      const sum = [...l, n].reduce((r, n) => (r += n), 0);
      if (sum <= target) {
        l.push(n);
        isAdd = true;
        break;
      }
    }
    if (!isAdd) result.push([n]);
  }
  return result;
}

// export const a = test([1,2,3,7,4,8,9,3,4,5], 10)
console.log(test([1, 2, 3, 7, 4, 8, 9, 3, 4, 5], 10));
