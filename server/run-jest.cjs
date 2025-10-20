// Small runner to invoke Jest programmatically on Windows without shell wrappers
const jest = require('jest');

const argv = ['--runInBand'];

jest.run(argv);
