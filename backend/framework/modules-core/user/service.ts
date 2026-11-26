import { TraikuService } from '../../modules';
import User from './models/user';
import UserAction from './models/user-action';

export default class UserModuleService extends TraikuService({ User, UserAction }) {}
