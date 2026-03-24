import Phaser from 'phaser';
import { TILE_SIZE, TILE } from '../map/OfficeMap';
import { eventBus } from '../../events/EventBus';

interface PlanStep {
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface TaskPlanEvent {
  type: 'task_plan';
  plan_id: string;
  goal: string;
  steps: Array<{ title: string; status?: string }>;
}

interface TaskPlanUpdateEvent {
  type: 'task_plan_update';
  plan_id: string;
  step_index: number;
  status: string;
  result_summary?: string;
}

const MAX_VISIBLE_STEPS = 5;
const STATUS_ICONS: Record<string, string> = {
  pending: '○',
  in_progress: '◉',
  completed: '✓',
  failed: '✗',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#888899',
  in_progress: '#ffcc44',
  completed: '#44dd66',
  failed: '#ff4444',
};

export class PlanBoard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private steps: PlanStep[] = [];
  private boardX = 0;
  private boardY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.findWhiteboard();
    this.listen();
  }

  private findWhiteboard(): void {
    this.boardX = 11 * TILE_SIZE + TILE_SIZE / 2;
    this.boardY = 20 * TILE_SIZE;
  }

  private listen(): void {
    eventBus.on('brain:task_plan', (ev: TaskPlanEvent) => {
      this.steps = ev.steps.map(s => ({
        title: s.title,
        status: (s.status as PlanStep['status']) || 'pending',
      }));
      this.render();
    });

    eventBus.on('brain:task_plan_update', (ev: TaskPlanUpdateEvent) => {
      if (ev.step_index >= 0 && ev.step_index < this.steps.length) {
        this.steps[ev.step_index].status = ev.status as PlanStep['status'];
        this.render();
      }
    });
  }

  private render(): void {
    this.container?.destroy();

    this.container = this.scene.add.container(this.boardX, this.boardY);
    this.container.setDepth(3);

    const bg = this.scene.add.graphics();
    const totalH = Math.min(this.steps.length, MAX_VISIBLE_STEPS) * (TILE_SIZE * 0.45) + TILE_SIZE * 0.4;
    const w = TILE_SIZE * 3.5;

    bg.fillStyle(0xe8e8f0, 0.95);
    bg.fillRoundedRect(-w / 2, 0, w, totalH, 2);
    bg.lineStyle(1, 0xccccdd, 0.8);
    bg.strokeRoundedRect(-w / 2, 0, w, totalH, 2);
    this.container.add(bg);

    const headerText = this.scene.add.text(0, TILE_SIZE * 0.12, '📋 Plan', {
      fontSize: `${Math.round(TILE_SIZE * 0.3)}px`,
      fontFamily: 'monospace',
      color: '#3a3a5e',
      fontStyle: 'bold',
    });
    headerText.setOrigin(0.5, 0);
    this.container.add(headerText);

    const visible = this.steps.slice(0, MAX_VISIBLE_STEPS);
    visible.forEach((step, i) => {
      const yOff = TILE_SIZE * 0.4 + i * TILE_SIZE * 0.45;

      const icon = STATUS_ICONS[step.status] || '○';
      const color = STATUS_COLORS[step.status] || '#888899';

      const statusText = this.scene.add.text(-w / 2 + 4, yOff, icon, {
        fontSize: `${Math.round(TILE_SIZE * 0.28)}px`,
        fontFamily: 'monospace',
        color,
      });
      statusText.setOrigin(0, 0);

      const maxLen = 18;
      const title = step.title.length > maxLen
        ? step.title.slice(0, maxLen - 2) + '..'
        : step.title;

      const stepText = this.scene.add.text(-w / 2 + TILE_SIZE * 0.4, yOff, title, {
        fontSize: `${Math.round(TILE_SIZE * 0.25)}px`,
        fontFamily: 'monospace',
        color: step.status === 'completed' ? '#44aa44' : '#3a3a5e',
      });
      stepText.setOrigin(0, 0);

      this.container!.add([statusText, stepText]);
    });

    if (this.steps.length > MAX_VISIBLE_STEPS) {
      const moreText = this.scene.add.text(0, totalH - TILE_SIZE * 0.15, `+${this.steps.length - MAX_VISIBLE_STEPS} más...`, {
        fontSize: `${Math.round(TILE_SIZE * 0.22)}px`,
        fontFamily: 'monospace',
        color: '#8888aa',
      });
      moreText.setOrigin(0.5, 1);
      this.container.add(moreText);
    }

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Quad.easeOut',
    });
  }
}
