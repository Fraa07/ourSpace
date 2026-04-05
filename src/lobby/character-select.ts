import { mod, PERSON_W, PERSON_H } from '../common';
import { Button, TextInput } from '../client/ui-elements';
import { UserInput } from '../client/user-input';
import { getCharacterDrawFunction, getCharacterNames } from '../client/characters';

export class CharacterSelect {
    private userInput: UserInput;
    
    private characterNames: string[];
    private selectedCharacterIndex: number;
    
    private leftBtn: Button;
    private rightBtn: Button;
    private okBtn: Button;
    private nameInput: TextInput;
    
    private onCharacterSelected: (name: string, character: string) => void;
    
    constructor(userInput: UserInput, onCharacterSelected: (name: string, character: string) => void) {
        this.userInput = userInput;
        this.onCharacterSelected = onCharacterSelected;
        
        this.characterNames = getCharacterNames();
        this.selectedCharacterIndex = 0;
        
        this.nameInput = new TextInput(userInput, 'nickname');
        
        this.leftBtn = new Button('<', userInput, () => {
            this.selectedCharacterIndex = mod(this.selectedCharacterIndex + 1, this.characterNames.length);
        });
        
        this.rightBtn = new Button('>', userInput, () => {
            this.selectedCharacterIndex = mod(this.selectedCharacterIndex - 1, this.characterNames.length);
        });
        
        this.okBtn = new Button('ok', userInput, () => {
            const name = this.nameInput.getValue() || '';
            if (name.length) {
                const character = this.characterNames[this.selectedCharacterIndex];
                this.onCharacterSelected(name, character);
            } else {
                alert("insert a nickname");
            }
        });
        this.okBtn.setColors({ main: "#58a515" });
    }
    
    draw(ctx: CanvasRenderingContext2D) {
        const { screenW, screenH } = this.userInput;
        const side = Math.min(screenH, screenW);

        ctx.save();

        ctx.translate(screenW/2, screenH/2); // centra lo schermo

        const borderWidth = 20;
        ctx.beginPath();
        ctx.rect(-side/2, -side/2, side, side);
        ctx.clip();
        ctx.strokeStyle = "#161616";
        ctx.lineWidth = borderWidth;
        ctx.fillStyle = "#acabab";
        ctx.fill();
        ctx.stroke();

        // personaggio
        const characterName = this.characterNames[this.selectedCharacterIndex];
        const characterH = side * 0.5;
        const characterW = characterH * PERSON_W / PERSON_H;
        const drawPerson = getCharacterDrawFunction(characterName);
        drawPerson(ctx, 0, 0, characterW, characterH);

        const padding = borderWidth + 5;

        // input nickname
        const nameInputW = side * 0.7;
        const nameInputH = side * 0.1;
        this.nameInput.draw(ctx, -nameInputW/2, -side/2 + padding, nameInputW, nameInputH);

        // bottoni
        const btnWidth = side * 0.1;
        const btnHeight = side  * 0.4;
        this.rightBtn.draw(ctx, side/2 - btnWidth - padding, -btnHeight/2, btnWidth, btnHeight);
        this.leftBtn.draw(ctx, -side/2 + padding, -btnHeight/2, btnWidth, btnHeight);
        const okBtnW = side * 0.4;
        const okBtnH = side * 0.1;
        this.okBtn.draw(ctx, -okBtnW/2, side/2 - okBtnH - padding, okBtnW, okBtnH);

        ctx.restore();
    }
    
    // Getter for the selected character (optional, can be removed if not needed)
    getSelectedCharacter(): string {
        return this.characterNames[this.selectedCharacterIndex];
    }
    
    // Getter for the entered name (optional, can be removed if not needed)
    getEnteredName(): string {
        return this.nameInput.getValue() || '';
    }
}