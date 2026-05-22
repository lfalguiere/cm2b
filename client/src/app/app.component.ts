// src/app/app.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: [`
    :host { display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; }
  `],
})
export class AppComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.auth.checkSetupNeeded().subscribe(needed => {
      if (needed) this.router.navigate(['/setup']);
    });
  }
}
