import { combineReducers } from 'redux';
import authReducer from './authReducer';
import chatReducer from './chatReducer';
import actionReducers from './actionReducers';

const rootReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  action: actionReducers,
});

export default rootReducer;