// Generador QR local, sin enviar datos de la billetera a servicios externos.
// Formato Version 2-L: hasta 32 bytes en modo texto.
(() => {
  const SIZE = 25;

  function multiply(a, b) {
    let result = 0;
    for (let i = 7; i >= 0; i -= 1) {
      result = (result << 1) ^ ((result >>> 7) * 0x11d);
      result ^= ((b >>> i) & 1) * a;
    }
    return result;
  }

  function reedSolomon(data, degree) {
    const divisor = Array(degree).fill(0);
    divisor[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < degree; j += 1) {
        divisor[j] = multiply(divisor[j], root);
        if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
      }
      root = multiply(root, 2);
    }

    const remainder = Array(degree).fill(0);
    for (const byte of data) {
      const factor = byte ^ remainder.shift();
      remainder.push(0);
      for (let i = 0; i < degree; i += 1) remainder[i] ^= multiply(divisor[i], factor);
    }
    return remainder;
  }

  function encode(text) {
    const bytes = [...new TextEncoder().encode(text)];
    if (bytes.length > 32) throw new Error('El contenido del QR es demasiado largo');

    const bits = [];
    const append = (value, length) => {
      for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    append(0b0100, 4);
    append(bytes.length, 8);
    bytes.forEach((byte) => append(byte, 8));
    for (let i = 0; i < Math.min(4, 272 - bits.length); i += 1) bits.push(0);
    while (bits.length % 8) bits.push(0);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
    }
    for (let pad = 0; data.length < 34; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
    const codewords = [...data, ...reedSolomon(data, 10)];

    const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const setFunction = (x, y, dark) => {
      if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) modules[y][x] = dark;
    };

    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          setFunction(cx + dx, cy + dy, distance !== 2 && distance <= 3);
        }
      }
    };
    finder(3, 3);
    finder(SIZE - 4, 3);
    finder(3, SIZE - 4);

    for (let i = 8; i < SIZE - 8; i += 1) {
      if (modules[6][i] === null) setFunction(i, 6, i % 2 === 0);
      if (modules[i][6] === null) setFunction(6, i, i % 2 === 0);
    }
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(18 + dx, 18 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }

    const formatData = 0b01000;
    let formatRemainder = formatData;
    for (let i = 0; i < 10; i += 1) formatRemainder = (formatRemainder << 1) ^ (((formatRemainder >>> 9) & 1) * 0x537);
    const formatBits = ((formatData << 10) | formatRemainder) ^ 0x5412;
    const bit = (index) => ((formatBits >>> index) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, bit(i));
    setFunction(8, SIZE - 8, true);

    let bitIndex = 0;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right -= 1;
      const upward = ((right + 1) & 2) === 0;
      for (let vertical = 0; vertical < SIZE; vertical += 1) {
        const y = upward ? SIZE - 1 - vertical : vertical;
        for (let offset = 0; offset < 2; offset += 1) {
          const x = right - offset;
          if (modules[y][x] !== null) continue;
          const value = bitIndex < codewords.length * 8
            ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
            : false;
          modules[y][x] = value !== ((x + y) % 2 === 0);
          bitIndex += 1;
        }
      }
    }
    return modules;
  }

  window.createSintegraQr = (text) => {
    const matrix = encode(text);
    const quiet = 4;
    const path = [];
    matrix.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) path.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE + quiet * 2} ${SIZE + quiet * 2}" role="img" aria-label="Código QR de cobro"><rect width="100%" height="100%" fill="#fff"/><path d="${path.join('')}" fill="#14214f"/></svg>`;
  };
})();
