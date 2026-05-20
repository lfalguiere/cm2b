import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ElementType, ElementClass, AttributeDefinition,
  SimpleAttributeType, EnumOption, RelationType,
} from '../../../core/models/api.models';

type Panel = 'none' | 'type' | 'class';

const SIMPLE_TYPES: { value: SimpleAttributeType; label: string }[] = [
  { value: 'STRING',     label: 'Texte court' },
  { value: 'TEXT',       label: 'Texte long' },
  { value: 'INTEGER',    label: 'Entier' },
  { value: 'FLOAT',      label: 'Décimal' },
  { value: 'BOOLEAN',    label: 'Booléen' },
  { value: 'DATE',       label: 'Date' },
  { value: 'DATETIME',   label: 'Date + heure' },
  { value: 'IP_ADDRESS', label: 'Adresse IP' },
  { value: 'EMAIL',      label: 'Email' },
  { value: 'URL',        label: 'URL' },
  { value: 'ENUM',       label: 'Énumération' },
  { value: 'CUSTOM',     label: 'Personnalisé (regex)' },
];

const RELATION_TYPES: { value: string; label: string; preposition: string }[] = [
  { value: 'APPARTENANCE', label: 'Appartenance', preposition: 'à' },
  { value: 'DEPENDANCE',   label: 'Dépendance',   preposition: 'de' },
  { value: 'PRODUCTION',   label: 'Production',   preposition: 'de' },
  { value: 'ACCES',        label: 'Accès',        preposition: 'à' },
  { value: 'ASSOCIATION',  label: 'Association',  preposition: 'avec' },
];

const TYPE_COLORS = [
  // Indigo / Violet
  '#6366f1','#4f46e5','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd',
  // Bleu / Cyan
  '#3b82f6','#2563eb','#0ea5e9','#06b6d4','#22d3ee','#67e8f9',
  // Vert / Teal
  '#10b981','#059669','#34d399','#22c55e','#84cc16','#a3e635',
  // Jaune / Orange
  '#f59e0b','#d97706','#f97316','#ea580c','#facc15','#fbbf24',
  // Rouge / Rose / Pink
  '#ef4444','#dc2626','#f87171','#ec4899','#db2777','#f472b6',
  // Gris / Slate
  '#64748b','#475569','#6b7280','#52525b','#3f3f46','#334155',
];

@Component({
  selector: 'app-elementclasses-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="shell">

  <!-- ── Topbar ── -->
  <header class="topbar">
    <img src="/cm2b.png" alt="CM2B" class="logo-img"/>
    <nav>
      <a href="/map">Cartographie</a>
      <a href="/liste">Elements</a>
    </nav>
    <a class="back" href="/admin">← Admin</a>
    <span class="page-title">Classes d'éléments</span>
    <div class="topbar-right">
      <button class="btn-logout" (click)="auth.logout()">Déconnexion</button>
    </div>
  </header>

  <div class="body">

    <!-- ── Panneau gauche : arbre types/classes ── -->
    <aside class="sidebar">
      <div class="sidebar-top">
        <button class="btn-new-type" (click)="openNewType()">+ Nouveau type</button>
      </div>

      <div class="tree">
        @for (type of types(); track type.id) {
          <!-- Type -->
          <div class="tree-type"
            [class.active]="panelType() === 'type' && selectedTypeId() === type.id"
            (click)="selectType(type)">
            <span class="type-dot" [style.background]="type.color ?? '#4f46e5'"></span>
            <span class="type-name">{{ type.name }}</span>
            <button class="tree-add" (click)="$event.stopPropagation(); openNewClass(type)">+</button>
          </div>

          <!-- Classes du type (arbre récursif aplati) -->
          @for (item of flatClassTree(type.id); track item.cls.id) {
            <div class="tree-class"
              [class.active]="panelType() === 'class' && selectedClassId() === item.cls.id"
              [style.padding-left.rem]="0.75 + item.depth * 0.75"
              (click)="selectClass(item.cls, type)">
              <span class="cls-indent">└</span>
              <span class="cls-name">{{ item.cls.name }}</span>
            </div>
          }
        }
      </div>
    </aside>

    <!-- ── Zone principale ── -->
    <main class="main">
      @if (panelType() === 'none') {
        <div class="empty-state">
          <div class="empty-icon">◈</div>
          <p>Sélectionnez un type ou une classe dans le panneau gauche</p>
          <small>ou créez un nouveau type d'élément</small>
        </div>
      }

      <!-- ─── Éditeur de TYPE ─── -->
      @if (panelType() === 'type') {
        <div class="editor">
          <div class="editor-header">
            <h2>{{ typeForm.id ? 'Modifier le type' : 'Nouveau type' }}</h2>
            @if (typeForm.id) {
              <button class="btn-danger" (click)="deleteType()">Supprimer</button>
            }
          </div>

          <div class="form">
            <label>Nom <span class="required">*</span></label>
            <input [(ngModel)]="typeForm.name" placeholder="ex: Actifs Techniques"/>

            <label>Description</label>
            <input [(ngModel)]="typeForm.description" placeholder="Description du type"/>

            <label>Couleur</label>
            <div class="color-picker">
              @for (c of typeColors; track c) {
                <div class="color-swatch"
                  [style.background]="c"
                  [class.selected]="typeForm.color === c"
                  (click)="typeForm.color = c">
                </div>
              }
              <input class="color-hex" [(ngModel)]="typeForm.color" placeholder="#6366f1" maxlength="7"/>
            </div>

            <div class="form-preview">
              <span class="type-preview-dot" [style.background]="typeForm.color || '#4f46e5'"></span>
              {{ typeForm.name || 'Aperçu' }}
            </div>

            @if (formError()) {
              <div class="form-error">{{ formError() }}</div>
            }
            <div class="form-btns">
              <button (click)="cancelEdit()">Annuler</button>
              <button class="primary" (click)="saveType()" [disabled]="saving()">
                {{ saving() ? 'Enregistrement…' : (typeForm.id ? 'Enregistrer' : 'Créer') }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ─── Éditeur de CLASSE ─── -->
      @if (panelType() === 'class') {
        <div class="editor">
          <div class="editor-header">
            <h2>{{ classForm.id ? 'Modifier la classe' : 'Nouvelle classe' }}</h2>
          </div>

          <div class="editor-cols">

            <!-- Colonne gauche : formulaire classe -->
            <div class="editor-left">
              <div class="form">
                <div class="form-field">
                  <label>Nom <span class="required">*</span></label>
                  <input [(ngModel)]="classForm.name" placeholder="ex: Serveur Windows"/>
                </div>

                <div class="form-field">
                  <label>Type <span class="required">*</span></label>
                  <select [(ngModel)]="classForm.typeId" (ngModelChange)="classForm.parentClassId = ''">
                    @for (t of types(); track t.id) {
                      <option [value]="t.id">{{ t.name }}</option>
                    }
                  </select>
                </div>

                <div class="form-field">
                  <label>Classe parente</label>
                  <select [(ngModel)]="classForm.parentClassId">
                    <option value="">— Aucune (racine) —</option>
                    @for (cls of siblingsForParent; track cls.id) {
                      <option [value]="cls.id">{{ cls.name }}</option>
                    }
                  </select>
                </div>

                <div class="form-field">
                  <label>Description</label>
                  <input [(ngModel)]="classForm.description" placeholder="Description de la classe"/>
                </div>

                <div class="form-field">
                  <label>Couleur (optionnel — hérite du type si vide)</label>
                  <div class="color-picker">
                    @for (c of typeColors; track c) {
                      <div class="color-swatch"
                        [style.background]="c"
                        [class.selected]="classForm.color === c"
                        (click)="classForm.color = c">
                      </div>
                    }
                    <div class="color-swatch color-none"
                      [class.selected]="!classForm.color"
                      (click)="classForm.color = ''">
                      ✕
                    </div>
                    <input class="color-hex" [(ngModel)]="classForm.color" placeholder="Héritée du type" maxlength="7"/>
                  </div>
                </div>

                @if (formError()) {
                  <div class="form-error">{{ formError() }}</div>
                }
                <div class="form-btns">
                  @if (classForm.id) {
                    <button class="btn-danger" (click)="deleteClass()">Supprimer</button>
                  }
                  <button (click)="cancelEdit()">Annuler</button>
                  <button class="primary" (click)="saveClass()" [disabled]="saving()">
                    {{ saving() ? 'Enregistrement…' : (classForm.id ? 'Enregistrer' : 'Créer') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Colonne droite : attributs simples -->
            @if (classForm.id) {
            <div class="editor-right">
              <div class="attrs-section">
              <div class="attrs-header">
                <span class="attrs-title">Propriétés simples</span>
                <button class="btn-add-attr" (click)="openNewAttr()">+ Ajouter</button>
              </div>

              @if (loadingAttrs()) {
                <div class="attrs-loading">Chargement…</div>
              } @else if (attrs().length === 0 && !attrForm.visible) {
                <div class="attrs-empty">Aucune propriété simple définie.</div>
              }

              <!-- Liste des attributs existants -->
              @for (attr of attrs(); track attr.id) {
                <div class="attr-row" [class.editing]="attrForm.id === attr.id">
                  @if (attrForm.id !== attr.id) {
                    <div class="attr-info">
                      <span class="attr-name">{{ attr.name }}</span>
                      <span class="attr-type-badge">{{ simpleTypeLabel(attr.simpleType) }}</span>
                      @if (attr.required) { <span class="attr-required-badge">requis</span> }
                      @if (attr.description) {
                        <span class="attr-desc">{{ attr.description }}</span>
                      }
                      <!-- Aperçu des valeurs enum -->
                      @if (attr.simpleType === 'ENUM' && attr.enumOptions) {
                        <div class="attr-enum-chips">
                          @for (opt of parseEnumOptions(attr.enumOptions); track opt.value) {
                            <span class="attr-enum-chip"
                              [style.color]="opt.color || '#e8e8e8'"
                              [style.background]="opt.bgColor || '#2a2a2a'"
                              [style.border-color]="opt.bgColor || '#3a3a3a'">
                              {{ opt.label || opt.value }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                    <div class="attr-actions">
                      <button (click)="editAttr(attr)">✏</button>
                      <button class="danger" (click)="deleteAttr(attr.id)">✕</button>
                    </div>
                  } @else {
                    <!-- Formulaire inline édition -->
                    <ng-container *ngTemplateOutlet="attrFormTpl"></ng-container>
                  }
                </div>
              }

              <!-- Formulaire création (hors liste) -->
              @if (attrForm.visible && !attrForm.id) {
                <div class="attr-row attr-new-row">
                  <ng-container *ngTemplateOutlet="attrFormTpl"></ng-container>
                </div>
              }
              </div><!-- /attrs-section -->

              <!-- ── Propriétés relationnelles ── -->
              <div class="attrs-section rel-section">
                <div class="attrs-header">
                  <span class="attrs-title">Propriétés relationnelles</span>
                  <button class="btn-add-attr" (click)="openNewRelAttr()">+ Ajouter</button>
                </div>

                @if (relAttrs().length === 0 && !relAttrForm.visible) {
                  <div class="attrs-empty">Aucune propriété relationnelle définie.</div>
                }

                @for (attr of relAttrs(); track attr.id) {
                  <div class="attr-row" [class.editing]="relAttrForm.id === attr.id">
                    @if (relAttrForm.id !== attr.id) {
                      <div class="attr-info">
                        <span class="attr-name">{{ attr.name }}</span>
                        <span class="attr-rel-badge">{{ relationTypeLabel(attr.relationType) }}</span>
                        <span class="attr-desc">→ {{ targetClassName(attr) }}</span>
                        @if (attr.inverseAttributeName) {
                          <span class="attr-desc attr-inverse-hint">↩ {{ attr.inverseAttributeName }}</span>
                        }
                      </div>
                      <div class="attr-actions">
                        <button (click)="editRelAttr(attr)">✏</button>
                        <button class="danger" (click)="deleteRelAttr(attr.id)">✕</button>
                      </div>
                    } @else {
                      <ng-container *ngTemplateOutlet="relAttrFormTpl"></ng-container>
                    }
                  </div>
                }

                @if (relAttrForm.visible && !relAttrForm.id) {
                  <div class="attr-row attr-new-row">
                    <ng-container *ngTemplateOutlet="relAttrFormTpl"></ng-container>
                  </div>
                }
              </div><!-- /rel-section -->
            </div><!-- /editor-right -->
            }<!-- /@if classForm.id -->
          </div><!-- /editor-cols -->
        </div><!-- /editor -->
      }
    </main>
  </div>
</div>

<!-- Template du formulaire d'attribut -->
<ng-template #attrFormTpl>
  <div class="attr-form">
    <div class="attr-form-row">
      <div class="af-field">
        <label>Nom <span class="required">*</span></label>
        <input [(ngModel)]="attrForm.name" placeholder="ex: adresse_ip"/>
      </div>
      <div class="af-field af-type">
        <label>Type</label>
        <select [(ngModel)]="attrForm.simpleType">
          @for (t of simpleTypes; track t.value) {
            <option [value]="t.value">{{ t.label }}</option>
          }
        </select>
      </div>
      <div class="af-field af-req">
        <label>Requis</label>
        <input type="checkbox" [(ngModel)]="attrForm.required" style="margin-top:.5rem"/>
      </div>
    </div>
    <div class="attr-form-row">
      <div class="af-field">
        <label>Description</label>
        <input [(ngModel)]="attrForm.description" placeholder="Description de la propriété"/>
      </div>
      @if (attrForm.simpleType === 'STRING') {
        <div class="af-field af-small">
          <label>Longueur max</label>
          <input type="number" [(ngModel)]="attrForm.maxLength" placeholder="255"/>
        </div>
      }
      @if (attrForm.simpleType === 'CUSTOM') {
        <div class="af-field">
          <label>Regex de validation</label>
          <input [(ngModel)]="attrForm.validationRegex" placeholder="^[A-Z]{3}\\d+$"/>
        </div>
      }
    </div>
    @if (attrForm.simpleType !== 'ENUM') {
      <div class="attr-form-row">
        <div class="af-field">
          <label>Valeur par défaut</label>
          <input [(ngModel)]="attrForm.defaultValue" placeholder="Optionnel"/>
        </div>
      </div>
    }

    <!-- ── Éditeur de valeurs ENUM ── -->
    @if (attrForm.simpleType === 'ENUM') {
      <div class="enum-editor">
        <div class="enum-editor-header">
          <span class="enum-editor-title">Valeurs de l'énumération</span>
          <button class="btn-add-enum" type="button" (click)="addEnumOption()">+ Ajouter</button>
        </div>

        @if (attrForm.enumOptions.length === 0) {
          <div class="enum-empty">Aucune valeur — cliquez sur + Ajouter</div>
        }

        @for (opt of attrForm.enumOptions; track $index) {
          <div class="enum-row">
            <!-- Preview chip -->
            <div class="enum-chip"
              [style.color]="opt.color || '#e8e8e8'"
              [style.background]="opt.bgColor || '#2a2a2a'"
              [style.border-color]="opt.bgColor || '#3a3a3a'">
              {{ opt.label || opt.value || '…' }}
            </div>

            <!-- Couleur texte (à gauche pour que le picker s'ouvre vers la droite) -->
            <div class="ef-field ef-color">
              <label>Texte</label>
              <div class="ef-color-wrap">
                <input type="color" [(ngModel)]="opt.color" [value]="opt.color || '#e8e8e8'"/>
                <span class="ef-color-hex">{{ opt.color || '#e8e8e8' }}</span>
              </div>
            </div>

            <!-- Couleur fond -->
            <div class="ef-field ef-color">
              <label>Fond</label>
              <div class="ef-color-wrap">
                <input type="color" [(ngModel)]="opt.bgColor" [value]="opt.bgColor || '#2a2a2a'"/>
                <span class="ef-color-hex">{{ opt.bgColor || '#2a2a2a' }}</span>
              </div>
            </div>

            <!-- Value (clé stockée) -->
            <div class="ef-field">
              <label>Valeur</label>
              <input [(ngModel)]="opt.value" placeholder="ex: ACTIF" class="ef-input ef-mono"/>
            </div>

            <!-- Label affiché -->
            <div class="ef-field ef-wide">
              <label>Libellé</label>
              <input [(ngModel)]="opt.label" placeholder="ex: Actif" class="ef-input"/>
            </div>

            <!-- Description (tooltip) -->
            <div class="ef-field ef-desc">
              <label>Description</label>
              <input [(ngModel)]="opt.description" placeholder="Texte au survol…" class="ef-input"/>
            </div>

            <button class="enum-del" type="button" (click)="removeEnumOption($index)" title="Supprimer">✕</button>
          </div>
        }
      </div>
    }

    @if (attrFormError()) {
      <div class="form-error">{{ attrFormError() }}</div>
    }
    <div class="attr-form-btns">
      @if (attrForm.id) {
        <button class="delete" (click)="deleteAttr(attrForm.id)">Supprimer</button>
      }
      <button (click)="cancelAttr()">Annuler</button>
      <button class="primary" (click)="saveAttr()" [disabled]="savingAttr()">
        {{ savingAttr() ? '…' : (attrForm.id ? 'Enregistrer' : 'Ajouter') }}
      </button>
    </div>
  </div>
</ng-template>

<!-- Template du formulaire de propriété relationnelle -->
<ng-template #relAttrFormTpl>
  <div class="attr-form">
    <div class="attr-form-row">
      <div class="af-field">
        <label>Nom <span class="required">*</span></label>
        <input [(ngModel)]="relAttrForm.name" placeholder="ex: Hébergé sur"/>
      </div>
      <div class="af-field af-type">
        <label>Type de relation <span class="required">*</span></label>
        <select [(ngModel)]="relAttrForm.relationType" (ngModelChange)="regenInverseName()">
          @for (r of relationTypes; track r.value) {
            <option [value]="r.value">{{ r.label }}</option>
          }
        </select>
      </div>
    </div>
    <div class="attr-form-row">
      <div class="af-field">
        <label>Classes cibles (vide = joker)</label>
        <div class="target-chips-wrap">
          @for (clsId of relAttrForm.targetClassIds; track clsId) {
            <span class="target-chip">
              {{ classNameById(clsId) }}
              <button type="button" (click)="removeTargetClass(clsId)">✕</button>
            </span>
          }
          @if (relAttrForm.targetClassIds.length === 0) {
            <span class="target-any">Toute classe</span>
          }
          <select (change)="addTargetClass($event)" style="flex:0 0 auto;width:auto;">
            <option value="">+ Ajouter</option>
            @for (cls of availableTargetClasses(); track cls.id) {
              <option [value]="cls.id">{{ cls.name }}</option>
            }
          </select>
        </div>
      </div>
    </div>
    <div class="attr-form-row">
      <div class="af-field">
        <label>Nom de la propriété sur la classe cible</label>
        <div class="rel-inverse-input-wrap">
          <input [(ngModel)]="relAttrForm.inverseAttributeName" [placeholder]="autoInverseName()"/>
          <button type="button" class="btn-regen" (click)="regenInverseName()" title="Regénérer">↺</button>
        </div>
      </div>
    </div>
    @if (relAttrFormError()) {
      <div class="form-error">{{ relAttrFormError() }}</div>
    }
    <div class="attr-form-btns">
      <button (click)="cancelRelAttr()">Annuler</button>
      <button class="primary" (click)="saveRelAttr()" [disabled]="savingRelAttr()">
        {{ savingRelAttr() ? '…' : (relAttrForm.id ? 'Enregistrer' : 'Ajouter') }}
      </button>
    </div>
  </div>
</ng-template>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Syne:wght@400;600;700&display=swap');

    :host {
      display: block; height: 100vh;
      --bg: #0d0d0d; --bg-panel: #111; --bg-card: #1c1c1c;
      --border: #2a2a2a; --border-b: #3a3a3a;
      --text: #e8e8e8; --muted: #555; --dim: #888;
      --accent: #6366f1;
      font-family: 'Syne', sans-serif; color: var(--text);
    }

    .shell { display:flex; flex-direction:column; height:100vh; background:var(--bg); }

    /* ── Topbar ── */
    .topbar {
      display:flex; align-items:center; gap:1rem;
      padding:.55rem 1.25rem; background:#0a0a0a;
      border-bottom:1px solid var(--border); flex-shrink:0;
      position:relative;
    }
    .logo-img { height:22px; width:auto; display:block; object-fit:contain; }
    nav { display:flex; gap:1.5rem; }
    nav a { color:#555; text-decoration:none; font-size:.78rem; letter-spacing:.04em; }
    nav a:hover { color:#aaa; }
    .back { color:var(--muted); text-decoration:none; font-size:.78rem; }
    .back:hover { color:var(--dim); }
    .page-title {
      position:absolute; left:50%; transform:translateX(-50%);
      font-size:.82rem; font-weight:400; color:#555;
      letter-spacing:.02em; font-family:'JetBrains Mono',monospace;
      pointer-events:none;
    }
    .topbar-right { margin-left:auto; }
    .btn-logout { background:none; border:1px solid #2a2a2a; border-radius:5px; color:#555; padding:.3rem .7rem; cursor:pointer; font-size:.75rem; font-family:'Syne',sans-serif; }
    .btn-logout:hover { color:#aaa; border-color:#555; }

    /* ── Body ── */
    .body { display:flex; flex:1; overflow:hidden; }

    /* ── Sidebar ── */
    .sidebar {
      width:240px; flex-shrink:0;
      background:var(--bg-panel); border-right:1px solid var(--border);
      display:flex; flex-direction:column; overflow:hidden;
    }
    .sidebar-top { padding:.6rem .75rem; border-bottom:1px solid var(--border); }
    .btn-new-type {
      width:100%; padding:.38rem .6rem; background:none;
      border:1px solid var(--border-b); border-radius:5px;
      color:var(--dim); font-size:.78rem; cursor:pointer; font-family:'Syne',sans-serif;
      text-align:left;
    }
    .btn-new-type:hover { border-color:#555; color:var(--text); }

    .tree {
      flex:1; overflow-y:auto; padding:.25rem 0;
      scrollbar-width: thin;
      scrollbar-color: #2a2a2a transparent;
    }
    .tree::-webkit-scrollbar { width: 5px; }
    .tree::-webkit-scrollbar-track { background: transparent; }
    .tree::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
    .tree::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }

    /* Type row */
    .tree-type {
      display:flex; align-items:center; gap:.4rem;
      padding:.4rem .75rem; cursor:pointer; user-select:none;
      border-left:3px solid transparent;
    }
    .tree-type:hover { background:#1a1a1a; }
    .tree-type.active { background:#1e1b3a; border-color:var(--accent); }
    .type-dot { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
    .type-name { font-size:.8rem; font-weight:600; flex:1; }
    .tree-add {
      background:none; border:none; color:var(--muted); cursor:pointer;
      font-size:.9rem; padding:.1rem .3rem; border-radius:3px; opacity:0;
    }
    .tree-type:hover .tree-add { opacity:1; }
    .tree-add:hover { color:var(--text); background:rgba(255,255,255,.06); }

    /* Class row */
    .tree-class {
      display:flex; align-items:center; gap:.3rem;
      padding:.28rem .75rem .28rem 1rem;
      cursor:pointer; user-select:none; font-size:.78rem; color:var(--dim);
      border-left:3px solid transparent;
    }
    .tree-class:hover { background:#1a1a1a; color:#ccc; }
    .tree-class.active { background:#16162a; color:#a5b4fc; border-color:var(--accent); }
.cls-indent { color:#2a2a2a; font-size:.7rem; }
    .cls-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cls-parent-badge {
      font-size:.62rem; color:#3a3a3a; font-family:'JetBrains Mono',monospace;
      white-space:nowrap;
    }

    /* ── Main editor ── */
    .main {
      flex: 1; overflow: hidden;
      display: flex; flex-direction: column;
      padding: 1.25rem 1.5rem; background: var(--bg);
    }

    .empty-state {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      flex:1; gap:.75rem; color:#333; text-align:center;
    }
    .empty-icon { font-size:2.5rem; color:#222; }
    .empty-state p { font-size:.88rem; color:#444; margin:0; }
    .empty-state small { font-size:.75rem; color:#2a2a2a; }

    /* Editor : prend toute la hauteur disponible */
    .editor {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
    }

    .editor-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem; flex-shrink: 0;
    }
    .editor-header h2 { margin:0; font-size:1rem; font-weight:700; color:var(--text); }

    /* Deux colonnes : form | attrs */
    .editor-cols {
      display: flex; flex: 1; gap: 1.5rem; min-height: 0; overflow: hidden;
    }
    .editor-left {
      flex: 2; min-width: 300px;
      overflow-y: auto; padding-right: .5rem;
    }
    .editor-right {
      flex: 3; overflow-y: auto;
      border-left: 1px solid var(--border); padding-left: 1.5rem;
    }

    /* ── Form ── */
    .form { display:flex; flex-direction:column; gap:.65rem; }

    /* Ligne à deux champs côte à côte */
    .form-row { display: flex; gap: .75rem; }
    .form-field { display: flex; flex-direction: column; gap: .2rem; flex: 1; min-width: 0; }

    label {
      font-size:.68rem; font-weight:700; color:var(--muted);
      letter-spacing:.08em; text-transform:uppercase; margin-bottom:-.2rem;
    }
    .required { color:#f87171; }

    input[type=text], input[type=number], select, input:not([type=checkbox]) {
      background:var(--bg-card); border:1px solid var(--border-b);
      border-radius:6px; color:var(--text); font-size:.84rem;
      padding:.5rem .75rem; outline:none; font-family:'Syne',sans-serif;
      width:100%;
    }
    input:focus, select:focus { border-color:var(--accent); }
    select option { background:#1c1c1c; }

    .color-picker { display:flex; align-items:center; gap:.4rem; flex-wrap:wrap; }
    .color-swatch {
      width:22px; height:22px; border-radius:4px; cursor:pointer;
      border:2px solid transparent; flex-shrink:0; transition:transform .1s;
      display:flex; align-items:center; justify-content:center; font-size:10px; color:#777;
    }
    .color-swatch:hover { transform:scale(1.15); }
    .color-swatch.selected { border-color:#fff; }
    .color-none { background:#1c1c1c; border-color:var(--border-b); }
    .color-hex { width:120px !important; font-family:'JetBrains Mono',monospace; font-size:.78rem; }

    .form-preview {
      display:flex; align-items:center; gap:.5rem;
      font-size:.8rem; color:var(--dim); padding:.4rem 0;
    }
    .type-preview-dot { width:10px; height:10px; border-radius:2px; flex-shrink:0; }

    .form-error { font-size:.78rem; color:#f87171; }

    .form-btns { display:flex; gap:.5rem; justify-content:flex-end; margin-top:.25rem; }
    .form-btns button, .dlg-btns button {
      padding:.42rem 1rem; border-radius:5px;
      border:1px solid var(--border-b); background:none;
      color:var(--dim); cursor:pointer; font-size:.8rem; font-family:'Syne',sans-serif;
    }
    .form-btns button:hover { color:var(--text); border-color:#555; }
    .form-btns button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .form-btns button.primary:hover { background:#4f46e5; }
    .form-btns button:disabled { opacity:.5; cursor:not-allowed; }

    .btn-danger {
      padding:.35rem .75rem; border-radius:5px; border:1px solid #991b1b;
      background:#ef4444; color:#fff; cursor:pointer; font-size:.78rem;
      font-family:'Syne',sans-serif; margin-right:auto;
    }
    .btn-danger:hover { background:#dc2626; border-color:#7f1d1d; }

    /* ── Attrs section ── */
    .attrs-section { /* border et padding gérés par editor-right */ }
    .attrs-header {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:.75rem;
    }
    .attrs-title {
      font-size:.7rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.09em; color:var(--muted);
    }
    .btn-add-attr {
      padding:.3rem .65rem; background:none; border:1px solid var(--border-b);
      border-radius:5px; color:var(--dim); cursor:pointer; font-size:.78rem;
      font-family:'Syne',sans-serif;
    }
    .btn-add-attr:hover { color:var(--text); border-color:#555; }

    .attrs-loading, .attrs-empty { font-size:.8rem; color:#333; padding:.5rem 0; }

    .rel-section { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border); }

    .attr-rel-badge {
      display:inline-block; font-size:.65rem; font-family:'JetBrains Mono',monospace;
      background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.3);
      border-radius:4px; padding:.08rem .4rem; color:#818cf8; width:fit-content;
    }
    .attr-inverse-hint { color:#2a2a2a; font-size:.72rem; font-style:italic; }

    .rel-inverse-input-wrap {
      display: flex; gap: .35rem; align-items: center;
    }
    .rel-inverse-input-wrap input { flex: 1; }
    .btn-regen {
      flex-shrink: 0; width: 30px; height: 32px;
      background: none; border: 1px solid var(--border-b); border-radius: 5px;
      color: var(--muted); cursor: pointer; font-size: .85rem;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-regen:hover { color: var(--text); border-color: #555; }

    .rel-target-locked {
      padding: .5rem .75rem; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 6px; font-size: .84rem; color: var(--dim); font-style: italic;
    }
    .target-chips-wrap {
      display: flex; flex-wrap: wrap; gap: .3rem; align-items: center;
      min-height: 34px; padding: .3rem .5rem;
      background: var(--bg-card); border: 1px solid var(--border-b); border-radius: 6px;
    }
    .target-chip {
      display: inline-flex; align-items: center; gap: .2rem;
      background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.35);
      border-radius: 4px; padding: .12rem .4rem; font-size: .75rem; color: #a5b4fc;
    }
    .target-chip button {
      background: none; border: none; color: inherit; cursor: pointer;
      padding: 0 .1rem; font-size: .65rem; opacity: .7; line-height: 1;
    }
    .target-chip button:hover { opacity: 1; }
    .target-any { font-size: .75rem; color: #444; font-style: italic; }

    /* Attribute row */
    .attr-row {
      display:flex; align-items:flex-start; justify-content:space-between;
      padding:.55rem .75rem; border:1px solid var(--border);
      border-radius:6px; margin-bottom:.4rem; background:var(--bg-panel);
      gap:.5rem;
    }
    .attr-row.editing { border-color:var(--accent); background:#0f0f1a; }
    .attr-new-row { border-color:var(--border-b); background:#0f0f1a; }

    .attr-info { display:flex; flex-direction:column; gap:.2rem; flex:1; min-width:0; }
    .attr-name { font-size:.84rem; font-weight:600; color:var(--text); }
    .attr-type-badge {
      display:inline-block; font-size:.65rem; font-family:'JetBrains Mono',monospace;
      background:#1e1e1e; border:1px solid var(--border-b);
      border-radius:4px; padding:.08rem .4rem; color:#888;
      width:fit-content;
    }
    .attr-required-badge {
      display:inline-block; font-size:.62rem; background:rgba(99,102,241,.15);
      color:#818cf8; border:1px solid rgba(99,102,241,.3);
      border-radius:4px; padding:.06rem .35rem; width:fit-content;
    }
    .attr-desc { font-size:.74rem; color:#444; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .attr-enum-chips { display:flex; flex-wrap:wrap; gap:.25rem; margin-top:.2rem; }
    .attr-enum-chip {
      font-size:.65rem; font-weight:600; padding:.12rem .4rem;
      border-radius:4px; border:1px solid; font-family:'Syne',sans-serif;
    }

    .attr-actions { display:flex; gap:.3rem; flex-shrink:0; }
    .attr-actions button {
      width:26px; height:26px; background:none; border:1px solid var(--border);
      border-radius:4px; color:var(--muted); cursor:pointer; font-size:.75rem;
    }
    .attr-actions button:hover { color:var(--text); border-color:#555; }
    .attr-actions button.danger:hover { color:#f87171; border-color:#5a1a1a; }

    /* Attr inline form */
    .attr-form { width:100%; display:flex; flex-direction:column; gap:.5rem; }
    .attr-form-row { display:flex; gap:.5rem; flex-wrap:wrap; }
    .af-field { display:flex; flex-direction:column; gap:.2rem; flex:1; min-width:120px; }
    .af-type { min-width:160px; flex:0 0 auto; }
    .af-small { min-width:90px; flex:0 0 90px; }
    .af-req { min-width:60px; flex:0 0 60px; }
    .attr-form label { margin-bottom:0; }
    .attr-form-btns { display:flex; gap:.4rem; justify-content:flex-end; margin-top:.2rem; align-items:center; }
    .attr-form-btns button.delete { margin-right:auto; background:#ef4444; border-color:#ef4444; color:#fff; }
    .attr-form-btns button {
      padding:.35rem .75rem; border-radius:5px;
      border:1px solid var(--border-b); background:none;
      color:var(--dim); cursor:pointer; font-size:.78rem; font-family:'Syne',sans-serif;
    }
    .attr-form-btns button:hover { color:var(--text); }
    .attr-form-btns button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .attr-form-btns button:disabled { opacity:.5; cursor:not-allowed; }

    /* ── Éditeur enum ── */
    .enum-editor {
      border: 1px solid var(--border-b); border-radius: 7px;
      padding: .65rem .75rem; display: flex; flex-direction: column; gap: .5rem;
      background: #0d0d14;
    }
    .enum-editor-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: .15rem;
    }
    .enum-editor-title {
      font-size: .65rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: var(--muted);
    }
    .btn-add-enum {
      padding: .22rem .55rem; background: none;
      border: 1px solid var(--border-b); border-radius: 4px;
      color: var(--dim); cursor: pointer; font-size: .72rem; font-family: 'Syne', sans-serif;
    }
    .btn-add-enum:hover { color: var(--text); border-color: #555; }
    .enum-empty { font-size: .76rem; color: #333; text-align: center; padding: .4rem 0; }

    .enum-row {
      display: flex; align-items: flex-end; gap: .45rem; flex-wrap: wrap;
      padding: .45rem .5rem; background: #111; border: 1px solid var(--border);
      border-radius: 6px;
    }

    /* Chip preview */
    .enum-chip {
      min-width: 64px; padding: .2rem .55rem; border-radius: 4px;
      font-size: .72rem; font-weight: 600; text-align: center;
      border: 1px solid; flex-shrink: 0; align-self: center;
      font-family: 'Syne', sans-serif; white-space: nowrap;
    }

    .ef-field { display: flex; flex-direction: column; gap: .18rem; }
    .ef-wide { flex: 1; min-width: 100px; }
    .ef-desc { flex: 2; min-width: 120px; }
    .ef-input {
      background: var(--bg-card); border: 1px solid var(--border-b);
      border-radius: 5px; color: var(--text); font-size: .78rem;
      padding: .38rem .5rem; outline: none; font-family: 'Syne', sans-serif; width: 100%;
    }
    .ef-input:focus { border-color: var(--accent); }
    .ef-mono { font-family: 'JetBrains Mono', monospace; font-size: .74rem; }
    .ef-field label { font-size: .6rem; }

    .ef-color { flex: 0 0 auto; }
    .ef-color-wrap { display: flex; align-items: center; gap: .3rem; }
    .ef-color-wrap input[type=color] {
      width: 28px; height: 28px; padding: 1px;
      border: 1px solid var(--border-b); border-radius: 4px;
      background: var(--bg-card); cursor: pointer;
    }
    .ef-color-hex { font-size: .64rem; font-family: 'JetBrains Mono', monospace; color: #444; }

    .enum-del {
      width: 24px; height: 24px; flex-shrink: 0; align-self: center;
      background: none; border: 1px solid #2a1a1a; border-radius: 4px;
      color: #444; cursor: pointer; font-size: .7rem;
    }
    .enum-del:hover { color: #f87171; border-color: #5a1a1a; background: rgba(244,67,54,.07); }
  `],
})
export class ElementClassesAdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  types      = signal<ElementType[]>([]);
  allClasses = signal<ElementClass[]>([]);
  attrs      = signal<AttributeDefinition[]>([]);
  relAttrs   = signal<AttributeDefinition[]>([]);

  loading        = signal(true);
  loadingAttrs   = signal(false);
  saving         = signal(false);
  savingAttr     = signal(false);
  savingRelAttr  = signal(false);
  formError      = signal('');
  attrFormError  = signal('');
  relAttrFormError = signal('');

  panelType       = signal<Panel>('none');
  selectedTypeId  = signal<string | null>(null);
  selectedClassId = signal<string | null>(null);

  readonly typeColors = TYPE_COLORS;
  readonly simpleTypes = SIMPLE_TYPES;
  readonly relationTypes = RELATION_TYPES;

  // ── Type form ─────────────────────────────────────────────────────────────
  typeForm = { id: '', name: '', description: '', color: '' };

  // ── Class form ────────────────────────────────────────────────────────────
  classForm = { id: '', name: '', typeId: '', parentClassId: '' as string, description: '', color: '' };

  // ── Rel attr form ─────────────────────────────────────────────────────────
  relAttrForm = {
    visible: false,
    id: '',
    name: '',
    targetClassIds: [] as string[],
    relationType: 'ASSOCIATION' as RelationType,
    inverseAttributeName: '',
  };

  // ── Attr form ─────────────────────────────────────────────────────────────
  attrForm = {
    visible: false, id: '',
    name: '', description: '',
    simpleType: 'STRING' as SimpleAttributeType,
    required: false, maxLength: null as number | null,
    validationRegex: '', defaultValue: '',
    enumOptions: [] as EnumOption[],
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Arbre aplati d'un type, avec profondeur pour l'indentation. */
  flatClassTree(typeId: string): { cls: ElementClass; depth: number }[] {
    const result: { cls: ElementClass; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const children = this.allClasses().filter(c =>
        c.typeId === typeId &&
        (parentId ? c.parentClassId === parentId : !c.parentClassId)
      );
      for (const cls of children) {
        result.push({ cls, depth });
        walk(cls.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }

  /** Classes disponibles comme parent : même type, pas soi-même, pas ses propres enfants. */
  get siblingsForParent(): ElementClass[] {
    return this.allClasses().filter(c =>
      c.typeId === this.classForm.typeId && c.id !== this.classForm.id
    );
  }

  parentName(id: string): string {
    return this.allClasses().find(c => c.id === id)?.name ?? '';
  }

  simpleTypeLabel(st?: string): string {
    return SIMPLE_TYPES.find(t => t.value === st)?.label ?? st ?? '?';
  }

  relationTypeLabel(rel?: string | null): string {
    return RELATION_TYPES.find(r => r.value === rel)?.label ?? rel ?? '?';
  }

  targetClassName(attr: AttributeDefinition): string {
    const ids = attr.targetClassIds ?? [];
    if (ids.length === 0) return 'Toute classe';
    return ids.map(id => this.classNameById(id)).join(', ');
  }

  classNameById(id?: string | null): string {
    if (!id) return '?';
    return this.allClasses().find(c => c.id === id)?.name ?? id;
  }

  availableTargetClasses = computed(() =>
    this.allClasses().filter(c => !this.relAttrForm.targetClassIds.includes(c.id))
  );

  addTargetClass(ev: Event) {
    const id = (ev.target as HTMLSelectElement).value;
    if (id && !this.relAttrForm.targetClassIds.includes(id)) {
      this.relAttrForm.targetClassIds = [...this.relAttrForm.targetClassIds, id];
    }
    (ev.target as HTMLSelectElement).value = '';
  }

  removeTargetClass(id: string) {
    this.relAttrForm.targetClassIds = this.relAttrForm.targetClassIds.filter(i => i !== id);
  }

  autoInverseName(): string {
    const rel = RELATION_TYPES.find(r => r.value === this.relAttrForm.relationType);
    const label = rel?.label ?? this.relAttrForm.relationType;
    const prep = rel?.preposition ?? 'de';
    return `${label} ${prep} ${this.classForm.name}`;
  }

  parseEnumOptions(json: string | null | undefined): EnumOption[] {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    this.loading.set(true);
    this.api.elementclasses.getTypes().subscribe(types => {
      this.types.set(types);
    });
    this.api.elementclasses.getClasses().subscribe(classes => {
      this.allClasses.set(classes);
      this.loading.set(false);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  openNewType() {
    this.typeForm = { id: '', name: '', description: '', color: TYPE_COLORS[0] };
    this.panelType.set('type');
    this.selectedTypeId.set(null);
    this.selectedClassId.set(null);
    this.formError.set('');
  }

  selectType(type: ElementType) {
    this.typeForm = {
      id: type.id, name: type.name,
      description: type.description ?? '',
      color: type.color ?? '',
    };
    this.panelType.set('type');
    this.selectedTypeId.set(type.id);
    this.selectedClassId.set(null);
    this.formError.set('');
  }

  openNewClass(type: ElementType) {
    this.classForm = {
      id: '', name: '', typeId: type.id,
      parentClassId: '', description: '', color: '',
    };
    this.panelType.set('class');
    this.selectedTypeId.set(type.id);
    this.selectedClassId.set(null);
    this.attrs.set([]);
    this.relAttrs.set([]);
    this.formError.set('');
    this.cancelAttr();
    this.cancelRelAttr();
  }

  selectClass(cls: ElementClass, type: ElementType) {
    this.classForm = {
      id: cls.id, name: cls.name, typeId: type.id,
      parentClassId: cls.parentClassId ?? '',
      description: cls.description ?? '',
      color: cls.color ?? '',
    };
    this.panelType.set('class');
    this.selectedTypeId.set(type.id);
    this.selectedClassId.set(cls.id);
    this.formError.set('');
    this.cancelAttr();
    this.cancelRelAttr();
    this.loadAttrs(cls.id);
  }

  cancelEdit() {
    this.panelType.set('none');
    this.formError.set('');
  }

  // ── Type CRUD ─────────────────────────────────────────────────────────────

  saveType() {
    if (!this.typeForm.name.trim()) { this.formError.set('Le nom est requis.'); return; }
    this.saving.set(true);
    this.formError.set('');
    const dto = {
      name: this.typeForm.name.trim(),
      description: this.typeForm.description || undefined,
      color: this.typeForm.color || undefined,
    };
    const req = this.typeForm.id
      ? this.api.elementclasses.updateType(this.typeForm.id, dto)
      : this.api.elementclasses.createType(dto);

    req.subscribe({
      next: () => { this.saving.set(false); this.loadAll(); },
      error: err => { this.saving.set(false); this.formError.set(err?.error?.message ?? 'Erreur'); },
    });
  }

  deleteType() {
    if (!this.typeForm.id) return;
    if (!confirm(`Supprimer le type "${this.typeForm.name}" ? Toutes ses classes seront supprimées.`)) return;
    this.api.elementclasses.deleteType(this.typeForm.id).subscribe({
      next: () => { this.panelType.set('none'); this.loadAll(); },
      error: err => this.formError.set(err?.error?.message ?? 'Erreur'),
    });
  }

  // ── Class CRUD ────────────────────────────────────────────────────────────

  saveClass() {
    if (!this.classForm.name.trim()) { this.formError.set('Le nom est requis.'); return; }
    if (!this.classForm.typeId)      { this.formError.set('Le type est requis.'); return; }
    this.saving.set(true);
    this.formError.set('');
    const dto = {
      name: this.classForm.name.trim(),
      typeId: this.classForm.typeId,
      parentClassId: this.classForm.parentClassId || null,
      description: this.classForm.description || undefined,
      color: this.classForm.color || undefined,
    };
    const req = this.classForm.id
      ? this.api.elementclasses.updateClass(this.classForm.id, dto)
      : this.api.elementclasses.createClass(dto);

    req.subscribe({
      next: (cls) => {
        this.saving.set(false);
        if (!this.classForm.id) {
          // Newly created: select it
          this.classForm.id = cls.id;
          this.selectedClassId.set(cls.id);
        }
        this.loadAll();
      },
      error: err => { this.saving.set(false); this.formError.set(err?.error?.message ?? 'Erreur'); },
    });
  }

  deleteClass() {
    if (!this.classForm.id) return;
    if (!confirm(`Supprimer la classe "${this.classForm.name}" ?`)) return;
    this.api.elementclasses.deleteClass(this.classForm.id).subscribe({
      next: () => { this.panelType.set('none'); this.loadAll(); },
      error: err => this.formError.set(err?.error?.message ?? 'Erreur'),
    });
  }

  // ── Attrs CRUD ────────────────────────────────────────────────────────────

  private loadAttrs(classId: string) {
    this.loadingAttrs.set(true);
    this.api.elementclasses.getEffectiveAttrs(classId).subscribe({
      next: attrs => {
        this.attrs.set(attrs.filter(a => a.kind === 'SIMPLE'));
        this.relAttrs.set(attrs.filter(a => a.kind === 'COMPLEX'));
        this.loadingAttrs.set(false);
      },
      error: () => this.loadingAttrs.set(false),
    });
  }

  openNewAttr() {
    this.attrForm = {
      visible: true, id: '',
      name: '', description: '',
      simpleType: 'STRING',
      required: false, maxLength: null,
      validationRegex: '', defaultValue: '',
      enumOptions: [],
    };
    this.attrFormError.set('');
  }

  editAttr(attr: AttributeDefinition) {
    let enumOptions: EnumOption[] = [];
    if (attr.simpleType === 'ENUM' && attr.enumOptions) {
      try { enumOptions = JSON.parse(attr.enumOptions); } catch { enumOptions = []; }
    }
    this.attrForm = {
      visible: true, id: attr.id,
      name: attr.name, description: attr.description ?? '',
      simpleType: (attr.simpleType ?? 'STRING') as SimpleAttributeType,
      required: attr.required,
      maxLength: attr.maxLength ?? null,
      validationRegex: attr.validationRegex ?? '',
      defaultValue: attr.defaultValue ?? '',
      enumOptions,
    };
    this.attrFormError.set('');
  }

  cancelAttr() {
    this.attrForm = {
      visible: false, id: '', name: '', description: '',
      simpleType: 'STRING', required: false,
      maxLength: null, validationRegex: '', defaultValue: '',
      enumOptions: [],
    };
    this.attrFormError.set('');
  }

  addEnumOption() {
    this.attrForm.enumOptions = [
      ...this.attrForm.enumOptions,
      { value: '', label: '', description: '', color: '#e8e8e8', bgColor: '#2a2a2a' },
    ];
  }

  removeEnumOption(index: number) {
    this.attrForm.enumOptions = this.attrForm.enumOptions.filter((_, i) => i !== index);
  }

  saveAttr() {
    if (!this.attrForm.name.trim()) { this.attrFormError.set('Le nom est requis.'); return; }
    if (this.attrForm.simpleType === 'ENUM') {
      const invalid = this.attrForm.enumOptions.some(o => !o.value.trim());
      if (invalid) { this.attrFormError.set('Chaque valeur enum doit avoir une clé.'); return; }
    }
    this.savingAttr.set(true);
    this.attrFormError.set('');

    const enumOptions = this.attrForm.simpleType === 'ENUM' && this.attrForm.enumOptions.length
      ? JSON.stringify(this.attrForm.enumOptions)
      : undefined;

    const dto: any = {
      elementClassId: this.classForm.id,
      name: this.attrForm.name.trim(),
      description: this.attrForm.description || undefined,
      kind: 'SIMPLE',
      simpleType: this.attrForm.simpleType,
      required: this.attrForm.required,
      maxLength: this.attrForm.maxLength || undefined,
      validationRegex: this.attrForm.validationRegex || undefined,
      defaultValue: this.attrForm.defaultValue || undefined,
      enumOptions,
    };

    const req = this.attrForm.id
      ? this.api.elementclasses.updateAttr(this.attrForm.id, dto)
      : this.api.elementclasses.createAttr(dto);

    req.subscribe({
      next: () => {
        this.savingAttr.set(false);
        this.cancelAttr();
        this.loadAttrs(this.classForm.id);
      },
      error: err => {
        this.savingAttr.set(false);
        this.attrFormError.set(err?.error?.message ?? 'Erreur');
      },
    });
  }

  deleteAttr(id: string) {
    if (!confirm('Supprimer cette propriété ?')) return;
    this.api.elementclasses.deleteAttr(id).subscribe({
      next: () => { this.cancelAttr(); this.loadAttrs(this.classForm.id); },
      error: err => this.attrFormError.set(err?.error?.message ?? 'Erreur'),
    });
  }

  // ── Rel attrs CRUD ────────────────────────────────────────────────────────

  openNewRelAttr() {
    this.relAttrForm = { visible: true, id: '', name: '', targetClassIds: [], relationType: 'ASSOCIATION', inverseAttributeName: this.autoInverseName() };
    this.relAttrFormError.set('');
  }

  editRelAttr(attr: AttributeDefinition) {
    this.relAttrForm = {
      visible: true,
      id: attr.id,
      name: attr.name,
      targetClassIds: attr.targetClassIds ? [...attr.targetClassIds] : [],
      relationType: (attr.relationType ?? 'ASSOCIATION') as RelationType,
      inverseAttributeName: attr.inverseAttributeName ?? '',
    };
    this.relAttrFormError.set('');
  }

  cancelRelAttr() {
    this.relAttrForm = { visible: false, id: '', name: '', targetClassIds: [], relationType: 'ASSOCIATION', inverseAttributeName: '' };
    this.relAttrFormError.set('');
  }

  regenInverseName() {
    this.relAttrForm.inverseAttributeName = this.autoInverseName();
  }

  saveRelAttr() {
    if (!this.relAttrForm.name.trim()) { this.relAttrFormError.set('Le nom est requis.'); return; }
    this.savingRelAttr.set(true);
    this.relAttrFormError.set('');

    const dto: any = {
      elementClassId: this.classForm.id,
      name: this.relAttrForm.name.trim(),
      kind: 'COMPLEX',
      relationType: this.relAttrForm.relationType,
      targetClassIds: this.relAttrForm.targetClassIds,
      inverseAttributeName: this.relAttrForm.inverseAttributeName.trim() || this.autoInverseName(),
    };

    const req = this.relAttrForm.id
      ? this.api.elementclasses.updateAttr(this.relAttrForm.id, dto)
      : this.api.elementclasses.createAttr(dto);

    req.subscribe({
      next: () => {
        this.savingRelAttr.set(false);
        this.cancelRelAttr();
        this.loadAttrs(this.classForm.id);
      },
      error: err => {
        this.savingRelAttr.set(false);
        this.relAttrFormError.set(err?.error?.message ?? 'Erreur');
      },
    });
  }

  deleteRelAttr(id: string) {
    if (!confirm('Supprimer cette propriété relationnelle et son inverse ?')) return;
    this.api.elementclasses.deleteAttr(id).subscribe({
      next: () => this.loadAttrs(this.classForm.id),
      error: err => this.relAttrFormError.set(err?.error?.message ?? 'Erreur'),
    });
  }
}
