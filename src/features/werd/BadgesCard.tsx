import { arNum } from '../../lib/arabic';
import { Icon } from '../../ui/Icon';
import { Progress } from '../../ui/kit';
import { achievementContext, evaluate } from './achievements';

export function BadgesCard() {
  const list = evaluate(achievementContext());
  const earned = list.filter((x) => x.unlocked).length;

  return (
    <section class="werd-section" aria-labelledby="werd-badges-title">
      <h2 class="section-title" id="werd-badges-title">
        <span>الإنجازات</span>
        <span class="tag tag-accent">
          {arNum(earned)} من {arNum(list.length)}
        </span>
      </h2>
      <ul class="werd-badges">
        {list.map(({ a, value, unlocked }) => {
          const shown = Math.min(value, a.goal);
          return (
            <li key={a.id} class={`werd-badge card${unlocked ? ' on' : ''}`}>
              <span class="werd-badge-icon" aria-hidden="true">
                <Icon name={a.icon} size={22} />
              </span>
              <span class="werd-badge-title">{a.title}</span>
              <span class="werd-badge-desc">{a.desc}</span>
              {unlocked ? (
                <span class="werd-badge-state">
                  <Icon name="checkCircle" size={14} /> تحقَّق
                </span>
              ) : (
                <span class="werd-badge-progress">
                  <Progress value={shown} max={a.goal} label={`التقدم نحو إنجاز ${a.title}`} />
                  <span class="werd-badge-count">
                    {arNum(shown)} / {arNum(a.goal)}
                    {a.unit ? ` ${a.unit}` : ''}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
