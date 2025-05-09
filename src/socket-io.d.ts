// socket-io.d.ts
import 'socket.io';
import { User } from './schemas/user/user.schema';

declare module 'socket.io' {
  interface Socket {
    data: {
      userInfo?: User;
    };
  }
}
