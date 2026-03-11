import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Api } from './services/api';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly api = inject(Api);
}
