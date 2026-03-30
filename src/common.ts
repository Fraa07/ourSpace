export const TICK_FREQUENCY = 20; // ticks per second

export type Person = {
    x: number;
    y: number;
    speed: number;
    character: string;
};

// Messaggi mandati dal server
export type ServerInitMsg = {
    kind: "init";
    yourId: string;
    people: Record<string, Person>;
};

export type ServerUpdateMsg = {
    kind: "update";
    people: Record<string, Person>;
};

export type ServerExitMsg = {
    kind: "exit";
    id: string;
};

export type ServerMsg =
    | ServerInitMsg
    | ServerUpdateMsg 
    | ServerExitMsg;

// if clientId is defined, the message will be sent to that specific client
// otherwise it will be sent to all clients
export type OutgoingServerMsg = {
    clientId?: string;
    payload: ServerMsg;
}

// Messaggi mandati dal client
export type ClientInitMsg = {
    kind: "init";
    character: string;
};

export type ClientMoveMsg = {
    kind: "move";
    x: number;
    y: number;
};

export type ClientMsg = 
    | ClientInitMsg 
    | ClientMoveMsg;

export type IncomingClientMsg = {
    clientId: string,
    payload: ClientMsg
};


// Funzioni matematiche
export const mod = (n: number, m: number) => ((n % m) + m) % m;


