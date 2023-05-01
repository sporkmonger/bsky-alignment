import { Decision } from '@/helpers/decision';
import { BskyAgent } from '@atproto/api';
import { ProfileView } from '@atproto/api/dist/client/types/app/bsky/actor/defs';

export interface LoginProps {
    onSubmit: (data: LoginData) => void,
}

export interface LoginData {
    identifier: string,
    password: string,
}

export interface LogoutProps {
    identifier?: string,
    onSubmit: () => void,
}

export interface AlignmentProps {
    agent?: BskyAgent,
    identifier?: string,
}

export interface SubjectData {
    profile: ProfileView,
    decisions: Array<Decision>
    pignistic?: number,
}

// From https://github.com/louislva/skyline under MIT license
// {

export type LoginResponseDataType = {
    accessJwt: string;
    did: string;
    email?: string;
    handle: string;
    refreshJwt: string;
};

export type RefreshJwtType = {
    exp: number;
    iat: number;
    jti: string; // long random key
    scope: string; // "com.atproto.refresh"
    sub: string; // did
};

export type AccessJwtType = {
    exp: number;
    iat: number;
    scope: string;
    sub: string;
};

// }
