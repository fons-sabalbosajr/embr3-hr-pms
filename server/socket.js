let io = null;

export const setSocketInstance = (ioInstance) => {
  io = ioInstance;
};

export const getSocketInstance = () => io;
