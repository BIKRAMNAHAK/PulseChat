export const TOGGLE_THEME = 'TOGGLE_THEME';
export const SET_THEME = 'SET_THEME';

const initialState = {
  mode: 'dark', // 'dark' | 'light'
};

const themeReducer = (state = initialState, action) => {
  switch (action.type) {
    case TOGGLE_THEME:
      return {
        ...state,
        mode: state.mode === 'dark' ? 'light' : 'dark',
      };
    case SET_THEME:
      return {
        ...state,
        mode: action.payload,
      };
    default:
      return state;
  }
};

export default themeReducer;
