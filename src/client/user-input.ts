export class UserInput {
    public canvas: HTMLCanvasElement;
    public screenW: number = 0;
    public screenH: number = 0;
    public xMoveDirection: number = 0;
    public yMoveDirection: number = 0;

    private up: boolean = false;
    private down: boolean = false;
    private left: boolean = false;
    private right: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.screenW = 0;
        this.screenH = 0;
        const resize = () => {
            this.canvas.width = window.innerWidth; 
            this.canvas.height = window.innerHeight;
            this.screenW = window.innerWidth;
            this.screenH = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // TODO movement on mobile with virtual joystick
        document.addEventListener("keydown", (event) => {
            if (event.repeat) return;

            if (event.code == "KeyW") this.up = true;
            else if (event.code == "KeyA") this.left = true;
            else if (event.code == "KeyS") this.down = true;
            else if (event.code == "KeyD") this.right = true;

            this.updateMoveDirections();
        });
        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyW") this.up = false;
            else if (event.code == "KeyA") this.left = false;
            else if (event.code == "KeyS") this.down = false;
            else if (event.code == "KeyD") this.right = false;

            this.updateMoveDirections();
        });

        window.addEventListener("blur", () => {
            this.xMoveDirection = 0;
            this.yMoveDirection = 0;
        });
    }

    updateMoveDirections() {
        this.xMoveDirection = 0;
        this.yMoveDirection = 0;
        if (this.up) this.yMoveDirection -= 1;
        if (this.left) this.xMoveDirection -= 1;
        if (this.down) this.yMoveDirection += 1;
        if (this.right) this.xMoveDirection += 1;
    }
}