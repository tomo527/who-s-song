import { useEffect, useReducer } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, firebaseConfigError } from '../firebase/config';
import type { Room } from '../types';

type RoomState = {
  resolvedRoomId: string | null;
  room: Room | null;
  error: Error | null;
};

type RoomAction =
  | { type: 'snapshot'; roomId: string; room: Room | null }
  | { type: 'error'; roomId: string; error: Error };

const initialState: RoomState = {
  resolvedRoomId: null,
  room: null,
  error: null,
};

const reducer = (state: RoomState, action: RoomAction): RoomState => {
  switch (action.type) {
    case 'snapshot':
      return {
        resolvedRoomId: action.roomId,
        room: action.room,
        error: null,
      };
    case 'error':
      return {
        resolvedRoomId: action.roomId,
        room: null,
        error: action.error,
      };
    default:
      return state;
  }
};

export const useRoom = (roomId: string) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!roomId || firebaseConfigError) {
      return;
    }

    const roomRef = doc(db, 'rooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        dispatch({
          type: 'snapshot',
          roomId,
          room: snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Room) : null,
        });
      },
      (error) => {
        dispatch({ type: 'error', roomId, error });
      },
    );

    return () => unsubscribe();
  }, [roomId]);

  if (!roomId) {
    return { room: null, loading: false, error: null };
  }

  if (firebaseConfigError) {
    return { room: null, loading: false, error: new Error(firebaseConfigError) };
  }

  return {
    room: state.resolvedRoomId === roomId ? state.room : null,
    loading: state.resolvedRoomId !== roomId,
    error: state.resolvedRoomId === roomId ? state.error : null,
  };
};
