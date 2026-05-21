// src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { tap, catchError, switchMap, filter, take, map } from 'rxjs/operators';
import {
  LoginRequest, AuthResponse, TokenPair, UserProfile,
} from '../models/api.models';
import { environment } from '../../../environments/environment';

const ACCESS_TOKEN_KEY  = 'cm2b_at';
const REFRESH_TOKEN_KEY = 'cm2b_rt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base   = `${environment.apiUrl}/auth`;

  // ── État réactif ────────────────────────────────────────────────────────────

  /** Profil courant (null = non connecté) */
  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin  = computed(() => this.currentUser()?.role === 'ADMIN');
  readonly isEditor = computed(() =>
    ['ADMIN', 'EDITOR'].includes(this.currentUser()?.role ?? ''),
  );

  /**
   * Subject utilisé par l'intercepteur pour sérialiser les refreshs concurrents.
   * null = aucun refresh en cours / string = nouveau token disponible.
   */
  private refreshInProgress = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor() {
    // Restaure le profil depuis le token stocké au démarrage de l'app
    this.hydrateFromStorage();
  }

  // ── API publique ────────────────────────────────────────────────────────────

  checkSetupNeeded(): Observable<boolean> {
    return this.http.get<{ setupNeeded: boolean }>(`${this.base}/setup-needed`).pipe(
      map(r => r.setupNeeded),
    );
  }

  setupAdmin(email: string, username: string, password: string): Observable<{ id: string; email: string }> {
    return this.http.post<{ id: string; email: string }>(`${this.base}/setup`, { email, username, password });
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, credentials).pipe(
      tap((res) => {
        this.storeTokens(res.accessToken, res.refreshToken);
        this.currentUser.set(res.user);
      }),
    );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Appel best-effort : on déconnecte localement même si la requête échoue
      this.http
        .post(`${this.base}/logout`, { refreshToken })
        .pipe(catchError(() => throwError(() => null)))
        .subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  logoutAll(): Observable<void> {
    return this.http.delete<void>(`${this.base}/sessions`).pipe(
      tap(() => this.clearSession()),
    );
  }

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.base}/me`).pipe(
      tap((user) => this.currentUser.set(user)),
    );
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  // ── Refresh (appelé par l'intercepteur) ────────────────────────────────────

  /**
   * Rafraîchit le token. Sérialise les appels concurrents :
   * si un refresh est déjà en cours, les autres requêtes attendent
   * le résultat plutôt que de déclencher un second refresh.
   */
  refreshAccessToken(): Observable<string> {
    if (this.refreshInProgress) {
      // Attend que le refresh en cours se termine
      return this.refreshSubject.pipe(
        filter((token): token is string => token !== null),
        take(1),
      );
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      this.router.navigate(['/login']);
      return throwError(() => new Error('Aucun refresh token disponible'));
    }

    this.refreshInProgress = true;
    this.refreshSubject.next(null);

    return this.http
      .post<TokenPair>(`${this.base}/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => {
          this.storeTokens(tokens.accessToken, tokens.refreshToken);
          this.refreshInProgress = false;
          this.refreshSubject.next(tokens.accessToken);
        }),
        switchMap((tokens) => [tokens.accessToken] as string[]),
        catchError((err) => {
          this.refreshInProgress = false;
          this.refreshSubject.next(null);
          this.clearSession();
          this.router.navigate(['/login']);
          return throwError(() => err);
        }),
      );
  }

  // ── Privé ───────────────────────────────────────────────────────────────────

  private storeTokens(accessToken: string, refreshToken: string): void {
    // Access token en sessionStorage (perdu à la fermeture de l'onglet)
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    // Refresh token en localStorage (persistant entre onglets)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  private clearSession(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUser.set(null);
  }

  private hydrateFromStorage(): void {
    const accessToken = this.getAccessToken();
    if (!accessToken) return;
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) return; // expiré
      this.currentUser.set({
        id: payload.sub,
        email: payload.email,
        username: payload.username ?? '',
        role: payload.role,
      });
    } catch {
      // Token malformé — on ignore
    }
  }
}
