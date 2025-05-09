import { User } from 'src/schemas/user/user.schema';

export interface IResponse<T = null> {
  success: boolean;
  message?: string;
  data: T;
}

export interface IClientData {
  userInfo?: User;
}
