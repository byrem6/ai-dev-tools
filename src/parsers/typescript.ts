import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { SymbolInfo } from '../types';

export class ASTParser {
  private code: string;
  private ast: t.File | null = null;

  constructor(code: string) {
    this.code = code;
    try {
      this.ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      }) as any;
    } catch (error) {
      this.ast = null;
    }
  }

  isValid(): boolean {
    return this.ast !== null;
  }

  extractSymbols(): SymbolInfo[] {
    if (!this.ast) {
      return [];
    }

    const symbols: SymbolInfo[] = [];

    traverse(this.ast, {
      // Function declarations
      FunctionDeclaration(path) {
        const node = path.node;
        if (node.id) {
          symbols.push({
            name: node.id.name,
            type: 'function',
            line: node.loc?.start.line || 0,
            end: node.loc?.end.line || 0,
            async: node.async,
            params: node.params.map(p => {
              if (t.isIdentifier(p)) {
                return p.name;
              }
              return 'unknown';
            }),
            returns: node.returnType ? 'typed' : 'any',
          });
        }
      },

      // Variable declarations
      VariableDeclaration(path) {
        const node = path.node;
        const kind = node.kind;

        node.declarations.forEach(declaration => {
          if (t.isIdentifier(declaration.id)) {
            const isConst = kind === 'const';
            const isArrowFunction = t.isArrowFunctionExpression(declaration.init) ||
                                   t.isFunctionExpression(declaration.init);

            symbols.push({
              name: declaration.id.name,
              type: isArrowFunction ? 'function' : 'const',
              line: path.node.loc?.start.line || 0,
              end: path.node.loc?.end.line || 0,
            });
          }
        });
      },

      // Class declarations
      ClassDeclaration(path) {
        const node = path.node;
        if (node.id) {
          const members: SymbolInfo[] = [];

          path.get('body').get('body').forEach(memberPath => {
            const memberNode = memberPath.node;
            if (t.isClassMethod(memberNode)) {
              const methodName = t.isIdentifier(memberNode.key) ? memberNode.key.name : 'unknown';
              members.push({
                name: methodName,
                type: 'method',
                line: memberNode.loc?.start.line || 0,
                end: memberNode.loc?.end.line || 0,
                async: memberNode.async,
              });
            } else if (t.isClassProperty(memberNode)) {
              const propName = t.isIdentifier(memberNode.key) ? memberNode.key.name : 'unknown';
              members.push({
                name: propName,
                type: 'variable',
                line: memberNode.loc?.start.line || 0,
              });
            }
          });

          symbols.push({
            name: node.id.name,
            type: 'class',
            line: path.node.loc?.start.line || 0,
            end: path.node.loc?.end.line || 0,
            exported: (path as any).isExported || false,
            members,
          });
        }
      },

      // Interface declarations (TypeScript)
      TSInterfaceDeclaration(path) {
        const node = path.node;
        symbols.push({
          name: node.id.name,
          type: 'interface',
          line: node.loc?.start.line || 0,
          end: node.loc?.end.line || 0,
          exported: true,
        });
      },

      // Type aliases (TypeScript)
      TSTypeAliasDeclaration(path) {
        const node = path.node;
        symbols.push({
          name: node.id.name,
          type: 'type',
          line: node.loc?.start.line || 0,
          end: node.loc?.end.line || 0,
          exported: true,
        });
      },

      // Enum declarations
      EnumDeclaration(path) {
        const node = path.node;
        symbols.push({
          name: node.id.name,
          type: 'enum',
          line: node.loc?.start.line || 0,
          end: node.loc?.end.line || 0,
          exported: (path as any).isExported || false,
        });
      },

      // Export named declarations
      ExportNamedDeclaration(path) {
        const node = path.node;
        if (node.declaration) {
          if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            const existing = symbols.find(s => s.name === (node.declaration as any).id!.name);
            if (existing) {
              existing.exported = true;
            }
          } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
            const existing = symbols.find(s => s.name === (node.declaration as any).id!.name);
            if (existing) {
              existing.exported = true;
            }
          } else if (t.isVariableDeclaration(node.declaration)) {
            node.declaration.declarations.forEach(declaration => {
              if (t.isIdentifier(declaration.id)) {
                const existing = symbols.find(s => s.name === (declaration.id as any).name);
                if (existing) {
                  existing.exported = true;
                }
              }
            });
          }
        }
      },
    });

    return symbols;
  }

  extractImports(): Array<{ source: string; specifiers: string[]; line: number }> {
    if (!this.ast) {
      return [];
    }

    const imports: Array<{ source: string; specifiers: string[]; line: number }> = [];

    traverse(this.ast, {
      ImportDeclaration(path) {
        const node = path.node;
        const specifiers: string[] = [];

        node.specifiers.forEach(spec => {
          if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec) || t.isImportNamespaceSpecifier(spec)) {
            specifiers.push(spec.local.name);
          }
        });

        imports.push({
          source: node.source.value,
          specifiers,
          line: node.loc?.start.line || 0,
        });
      },
    });

    return imports;
  }

  extractExports(): Array<{ name: string; type: string; line: number }> {
    if (!this.ast) {
      return [];
    }

    const exports: Array<{ name: string; type: string; line: number }> = [];

    traverse(this.ast, {
      ExportNamedDeclaration(path) {
        const node = path.node;

        if (node.declaration) {
          if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
            exports.push({
              name: node.declaration.id.name,
              type: 'function',
              line: path.node.loc?.start.line || 0,
            });
          } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
            exports.push({
              name: node.declaration.id.name,
              type: 'class',
              line: path.node.loc?.start.line || 0,
            });
          } else if (t.isVariableDeclaration(node.declaration)) {
            node.declaration.declarations.forEach(declaration => {
              if (t.isIdentifier(declaration.id)) {
                exports.push({
                  name: declaration.id.name,
                  type: 'const',
                  line: path.node.loc?.start.line || 0,
                });
              }
            });
          } else if (t.isTSTypeAliasDeclaration(node.declaration)) {
            exports.push({
              name: node.declaration.id.name,
              type: 'type',
              line: path.node.loc?.start.line || 0,
            });
          } else if (t.isTSInterfaceDeclaration(node.declaration)) {
            exports.push({
              name: node.declaration.id.name,
              type: 'interface',
              line: path.node.loc?.start.line || 0,
            });
          }
        }

        if (node.specifiers) {
          node.specifiers.forEach(spec => {
            if (t.isExportSpecifier(spec)) {
              const exportedName = t.isIdentifier(spec.exported) ? spec.exported.name : 
                                   t.isStringLiteral(spec.exported) ? spec.exported.value : 'unknown';
              exports.push({
                name: exportedName,
                type: 'value',
                line: path.node.loc?.start.line || 0,
              });
            }
          });
        }
      },

      ExportDefaultDeclaration(path) {
        const node = path.node;

        if (t.isIdentifier(node.declaration)) {
          exports.push({
            name: node.declaration.name,
            type: 'default',
            line: path.node.loc?.start.line || 0,
          });
        } else if (t.isFunctionDeclaration(node.declaration) && node.declaration.id) {
          exports.push({
            name: node.declaration.id.name,
            type: 'default',
            line: path.node.loc?.start.line || 0,
          });
        } else if (t.isClassDeclaration(node.declaration) && node.declaration.id) {
          exports.push({
            name: node.declaration.id.name,
            type: 'default',
            line: path.node.loc?.start.line || 0,
          });
        }
      },
    });

    return exports;
  }

  findFunctionByName(name: string): { start: number; end: number; body: string } | null {
    if (!this.ast) {
      return null;
    }

    let result: { start: number; end: number; body: string } | null = null;
    const code = this.code;

    traverse(this.ast, {
      FunctionDeclaration(path) {
        const node = path.node;
        if (node.id && node.id.name === name) {
          const start = path.node.loc?.start.line || 0;
          const end = path.node.loc?.end.line || 0;
          const body = code.split('\n').slice(start - 1, end).join('\n');
          result = { start, end, body };
        }
      },

      ClassMethod(path) {
        const node = path.node;
        if (t.isIdentifier(node.key) && node.key.name === name) {
          const start = path.node.loc?.start.line || 0;
          const end = path.node.loc?.end.line || 0;
          const body = code.split('\n').slice(start - 1, end).join('\n');
          result = { start, end, body };
        }
      },
    });

    return result;
  }
}
