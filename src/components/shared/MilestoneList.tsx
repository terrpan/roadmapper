import { useState } from 'react';
import type { Milestone } from '../../types';
import { useRoadmapStore } from '../../store/roadmapStore';

interface Props {
  itemId: string;
  milestones: Milestone[];
}

export function MilestoneList({ itemId, milestones }: Props) {
  const [newTitle, setNewTitle] = useState('');
  const addMilestone = useRoadmapStore((s) => s.addMilestone);
  const removeMilestone = useRoadmapStore((s) => s.removeMilestone);
  const toggleMilestone = useRoadmapStore((s) => s.toggleMilestone);

  const completed = milestones.filter((m) => m.completed).length;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
        Milestones {milestones.length > 0 && `(${completed}/${milestones.length})`}
      </h3>

      {milestones.length > 0 && (
        <div className="mb-2 h-1.5 w-full rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-green-500 transition-all"
            style={{ width: `${milestones.length > 0 ? (completed / milestones.length) * 100 : 0}%` }}
          />
        </div>
      )}

      <ul className="space-y-1 mb-2">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={m.completed}
              onChange={() => toggleMilestone(itemId, m.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-sm flex-1 ${m.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {m.title}
            </span>
            <button
              onClick={() => removeMilestone(itemId, m.id)}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 text-xs"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim()) {
            addMilestone(itemId, newTitle.trim());
            setNewTitle('');
          }
        }}
        className="flex gap-1"
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add milestone..."
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
        >
          +
        </button>
      </form>
    </div>
  );
}
