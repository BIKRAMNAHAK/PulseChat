import { applyMiddleware, compose, createStore } from "redux";
import { thunk } from "redux-thunk";
import { persistStore, persistReducer } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import rootReducer from "./Reducers/combineReducer";

const persistConfig = {
    key: "root",
    storage: AsyncStorage,
    whitelist: ["auth"],   
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const composeEnhancers = (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;

const store = createStore(
    persistedReducer,
    composeEnhancers(applyMiddleware(thunk))
);

export const persistor = persistStore(store);
export default store;