import { combineReducers } from 'redux';
import authReducer from './authReducer';
import chatReducer from './chatReducer';
import actionReducers from './actionReducers';
import themeReducer from './themeReducer';

const rootReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  action: actionReducers,
  theme: themeReducer,
});

export default rootReducer;