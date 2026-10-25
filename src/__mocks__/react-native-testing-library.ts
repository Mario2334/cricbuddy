// Mock React Native Testing Library for unit tests
export const render = jest.fn((component) => ({
  getByPlaceholderText: jest.fn(),
  getByDisplayValue: jest.fn(),
  getByText: jest.fn(),
  queryByText: jest.fn(),
  getByTestId: jest.fn(),
  queryByTestId: jest.fn(),
  container: {},
}));

export const fireEvent = {
  changeText: jest.fn(),
  press: jest.fn(),
  submitEditing: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
};

export const waitFor = jest.fn((callback) => Promise.resolve(callback()));

export const act = jest.fn((callback) => Promise.resolve(callback()));