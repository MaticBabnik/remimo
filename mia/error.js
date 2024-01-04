export default class MiaError extends Error {
    constructor(token, name, message = "") {
        super(
            `${message} (${token.type} "${token.value}" @ ${token.startLine}:${token.startColumn})`
        );
        this.token = token;
        this.msg = message;
        this.name = name;
    }
}
