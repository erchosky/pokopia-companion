'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  parseProgress,
  readProgressSnapshot,
  recordSearch,
  writeProgress,
} from '@/lib/progress-store';

const COMMANDS = [
  {
    label: 'Buscar en todo Pokopia',
    hint: 'Entidad o pregunta',
    href: '/buscar',
    keywords: 'search buscar',
  },
  {
    label: 'Abrir Palette Town',
    hint: 'Pueblo',
    href: '/towns/palettetown',
    keywords: 'town pueblo palette',
  },
  {
    label: 'Abrir My Pokopia',
    hint: 'Progreso',
    href: '/my-pokopia',
    keywords: 'progress goals objetivos',
  },
  {
    label: 'Planificar automatización',
    hint: 'Herramienta',
    href: '/automation#planner',
    keywords: 'automation planner automatizar',
  },
  {
    label: 'Comparar objetos',
    hint: 'Herramienta',
    href: '/compare',
    keywords: 'compare comparar storage',
  },
  {
    label: 'Mejor Pokémon para construir',
    hint: 'Ranking',
    href: '/best-pokemon/construction',
    keywords: 'best pokemon build construir',
  },
  {
    label: 'Abrir Crafting',
    hint: 'Calculadora',
    href: '/recipes',
    keywords: 'craft receta fabricar',
  },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return needle
      ? COMMANDS.filter((command) =>
          `${command.label} ${command.hint} ${command.keywords}`
            .toLocaleLowerCase('es')
            .includes(needle),
        )
      : COMMANDS;
  }, [query]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('en') === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const navigate = (href: string, search?: string) => {
    // Read progress at navigation time: the palette is in every page's header and does not need
    // to re-render on every progress change.
    if (search) writeProgress(recordSearch(parseProgress(readProgressSnapshot()), search));
    setOpen(false);
    setQuery('');
    router.push(href);
  };
  const submit = () => {
    const command = visible[0];
    if (command) navigate(command.href);
    else if (query.trim().length >= 2)
      navigate(`/buscar?q=${encodeURIComponent(query.trim())}`, query.trim());
  };
  return (
    <>
      <button
        aria-label="Abrir búsqueda global"
        className="command-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⌕</span>
        <span>Buscar</span>
        <kbd>⌘ K</kbd>
      </button>
      {open ? (
        <div className="command-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            aria-label="Búsqueda y comandos"
            aria-modal="true"
            className="command-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <label className="command-input">
              <span className="sr-only">Buscar o ejecutar un comando</span>
              <input
                ref={input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit();
                }}
                placeholder="Busca una entidad o escribe una tarea…"
              />
              <kbd>ESC</kbd>
            </label>
            <div className="command-results">
              {visible.map((command) => (
                <button type="button" key={command.href} onClick={() => navigate(command.href)}>
                  <span>{command.label}</span>
                  <small>{command.hint}</small>
                </button>
              ))}
              {!visible.length && query.trim().length >= 2 ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/buscar?q=${encodeURIComponent(query.trim())}`, query.trim())
                  }
                >
                  <span>Buscar “{query.trim()}”</span>
                  <small>Búsqueda universal</small>
                </button>
              ) : null}
            </div>
            <p className="command-help">Enter para abrir · Esc para cerrar</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
