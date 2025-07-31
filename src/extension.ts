import * as vscode from 'vscode';

const dimDecorationTypes = new Map<vscode.TextEditor, Map<string, vscode.TextEditorDecorationType>>();

function getRangeKey(range: vscode.Range): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

function parseRangeKey(key: string): vscode.Range {
    const [start, end] = key.split('-');
    const [startLine, startChar] = start.split(':').map(Number);
    const [endLine, endChar] = end.split(':').map(Number);
    return new vscode.Range(new vscode.Position(startLine, startChar), new vscode.Position(endLine, endChar));
}

function differenceRanges(original: vscode.Range, toSubtract: vscode.Range): vscode.Range[] {
    const result: vscode.Range[] = [];

    // No overlap
    if (!original.intersection(toSubtract)) {
        result.push(original);
        return result;
    }

    // Subtract from the start
    if (original.start.isBefore(toSubtract.start)) {
        result.push(new vscode.Range(original.start, toSubtract.start));
    }

    // Subtract from the end
    if (original.end.isAfter(toSubtract.end)) {
        result.push(new vscode.Range(toSubtract.end, original.end));
    }

    return result;
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('quickDim.dim', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        if (!dimDecorationTypes.has(editor)) {
            dimDecorationTypes.set(editor, new Map());
        }
        const editorDimDecorations = dimDecorationTypes.get(editor)!;
        const opacity = vscode.workspace.getConfiguration('quickDim').get('opacity');

        for (let selection of editor.selections) {
            let newRange = new vscode.Range(
                editor.document.lineAt(selection.start.line).range.start,
                editor.document.lineAt(selection.end.line).range.end
            );

            const intersectingRanges: vscode.Range[] = [];
            editorDimDecorations.forEach((_, key) => {
                const existingRange = parseRangeKey(key);
                if (existingRange.intersection(newRange)) {
                    intersectingRanges.push(existingRange);
                }
            });

            for (const intersectingRange of intersectingRanges) {
                newRange = newRange.union(intersectingRange);
                const decoration = editorDimDecorations.get(getRangeKey(intersectingRange));
                decoration?.dispose();
                editorDimDecorations.delete(getRangeKey(intersectingRange));
            }

            const dimDecorationType = vscode.window.createTextEditorDecorationType({ opacity: `${opacity}` });
            editorDimDecorations.set(getRangeKey(newRange), dimDecorationType);
            editor.setDecorations(dimDecorationType, [newRange]);
            context.subscriptions.push(dimDecorationType);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('quickDim.undim', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const editorDimDecorations = dimDecorationTypes.get(editor);
        if (!editorDimDecorations) {
            return;
        }

        const opacity = vscode.workspace.getConfiguration('quickDim').get('opacity');

        for (const selection of editor.selections) {
            const undimRange = new vscode.Range(
                editor.document.lineAt(selection.start.line).range.start,
                editor.document.lineAt(selection.end.line).range.end
            );

            const intersectingRanges: vscode.Range[] = [];
            editorDimDecorations.forEach((_, key) => {
                const existingRange = parseRangeKey(key);
                if (existingRange.intersection(undimRange)) {
                    intersectingRanges.push(existingRange);
                }
            });

            for (const intersectingRange of intersectingRanges) {
                const decoration = editorDimDecorations.get(getRangeKey(intersectingRange));
                decoration?.dispose();
                editorDimDecorations.delete(getRangeKey(intersectingRange));

                const newRanges = differenceRanges(intersectingRange, undimRange);
                for (const newRange of newRanges) {
                    if (!newRange.isEmpty) {
                        const dimDecorationType = vscode.window.createTextEditorDecorationType({ opacity: `${opacity}` });
                        editorDimDecorations.set(getRangeKey(newRange), dimDecorationType);
                        editor.setDecorations(dimDecorationType, [newRange]);
                        context.subscriptions.push(dimDecorationType);
                    }
                }
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('quickDim.undimEntireFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const editorDimDecorations = dimDecorationTypes.get(editor);
            if (editorDimDecorations) {
                editorDimDecorations.forEach(decoration => decoration.dispose());
                editorDimDecorations.clear();
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('quickDim.dimEntireFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        if (!dimDecorationTypes.has(editor)) {
            dimDecorationTypes.set(editor, new Map());
        }
        const editorDimDecorations = dimDecorationTypes.get(editor)!;
        const opacity = vscode.workspace.getConfiguration('quickDim').get('opacity');

        const entireFileRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(editor.document.getText().length)
        );

        const dimDecorationType = vscode.window.createTextEditorDecorationType({ opacity: `${opacity}` });
        editorDimDecorations.set(getRangeKey(entireFileRange), dimDecorationType);
        editor.setDecorations(dimDecorationType, [entireFileRange]);
        context.subscriptions.push(dimDecorationType);
    }));

    context.subscriptions.push({
        dispose: () => {
            dimDecorationTypes.forEach(editorDecorations => {
                editorDecorations.forEach(decoration => decoration.dispose());
            });
            dimDecorationTypes.clear();
        }
    });
}