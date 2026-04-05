# Flutter Patterns Skill

## When to load this skill

Load when working on a Flutter project: adding features, reviewing code, debugging widget behavior, or setting up state management. Assume **Riverpod** unless the codebase shows otherwise.

---

## Project Structure

```
lib/
  main.dart                    # ProviderScope wraps MaterialApp
  app/
    router.dart                # go_router or Navigator routes
  features/
    <feature>/
      data/
        <feature>_repository.dart     # data access — abstract class + impl
      domain/
        <feature>_model.dart          # immutable data models (freezed or manual)
      application/
        <feature>_notifier.dart       # Riverpod Notifier / AsyncNotifier
      presentation/
        <feature>_screen.dart         # top-level screen widget
        widgets/                      # extracted sub-widgets
  shared/
    providers/                 # shared providers (auth, theme, connectivity)
    widgets/                   # reusable UI components
```

One feature per folder. No cross-feature direct imports — go through providers.

---

## Riverpod Patterns

### Provider types — pick the right one

| Need | Provider |
|---|---|
| Computed / derived value | `Provider` |
| Simple mutable state | `NotifierProvider` |
| Async data (network, DB) | `AsyncNotifierProvider` |
| Stream (WebSocket, Firestore) | `StreamNotifierProvider` |
| Scoped / family variants | Add `.family` modifier |
| Auto-dispose when no listeners | Add `.autoDispose` modifier |

### AsyncNotifier — canonical pattern

```dart
@riverpod
class UserProfile extends _$UserProfile {
  @override
  Future<User> build(String userId) async {
    // Called once on first watch. Auto-cancelled on dispose if autoDispose.
    return ref.watch(userRepositoryProvider).fetchUser(userId);
  }

  Future<void> update(UserUpdate update) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() =>
      ref.read(userRepositoryProvider).updateUser(update),
    );
  }
}
```

### ref.watch vs ref.read — the rule

- `ref.watch(provider)` — inside `build()` only. Rebuilds widget/notifier when value changes.
- `ref.read(provider)` — inside callbacks, `onPressed`, notifier methods. One-shot, no subscription.
- `ref.listen(provider, (prev, next) { ... })` — side effects in `build()` (navigation, snackbars). Never use `ref.watch` for side effects.

### ConsumerWidget — standard widget

```dart
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({required this.userId, super.key});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId));

    return profile.when(
      data: (user) => ProfileBody(user: user),
      loading: () => const CircularProgressIndicator(),
      error: (e, st) => ErrorView(error: e),
    );
  }
}
```

Never use `StatefulWidget` just to hold a `ref`. Use `ConsumerStatefulWidget` when you need both `WidgetRef` and lifecycle methods (`initState`, `dispose`).

---

## Widget Performance

### Always const

```dart
// BAD
Text('Hello')

// GOOD
const Text('Hello')
```

Run `flutter analyze` — it flags missing `const` as a hint. Fix all of them.

### Extract widgets, don't use functions

```dart
// BAD — re-runs on every parent rebuild, no identity
Widget _buildHeader() => Text(title);

// GOOD — has identity, can be const, can be profiled
class _Header extends StatelessWidget {
  const _Header({required this.title});
  final String title;
  @override Widget build(BuildContext context) => Text(title);
}
```

### Large lists

```dart
// BAD — builds all items
Column(children: items.map((i) => ItemTile(i)).toList())

// GOOD — builds only visible items
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) => ItemTile(items[index]),
)
```

### Expensive subtrees

Wrap independently-animating or expensive subtrees in `RepaintBoundary`:

```dart
RepaintBoundary(
  child: HeavyChartWidget(data: data),
)
```

---

## Async & BuildContext Safety

**Always check `mounted` before using `context` after an `await`:**

```dart
Future<void> _submit() async {
  await ref.read(authProvider.notifier).login(email, password);
  if (!mounted) return;  // widget may have been disposed
  context.go('/home');
}
```

**Never capture `BuildContext` in a closure that outlives the widget:**

```dart
// BAD
Future.delayed(const Duration(seconds: 2), () {
  ScaffoldMessenger.of(context).showSnackBar(...); // context may be invalid
});

// GOOD
Future.delayed(const Duration(seconds: 2), () {
  if (!mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(...);
});
```

---

## State Lifecycle — Dispose Everything

```dart
class _MyWidgetState extends ConsumerState<MyWidget> {
  late final TextEditingController _controller;
  late final AnimationController _animation;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _animation = AnimationController(vsync: this, duration: kThemeAnimationDuration);
  }

  @override
  void dispose() {
    _controller.dispose();
    _animation.dispose();
    super.dispose();
  }
}
```

Controllers created in `build()` are recreated on every rebuild and never disposed — always use `initState`.

---

## Navigation (go_router)

```dart
// Define routes as constants
GoRoute(
  path: '/profile/:id',
  builder: (context, state) => ProfileScreen(
    userId: state.pathParameters['id']!,
  ),
),

// Navigate
context.go('/profile/${user.id}');       // replace current
context.push('/profile/${user.id}');     // push on stack
context.pop();                           // go back
```

Use `PopScope` (Flutter 3.12+), not the deprecated `WillPopScope`:

```dart
PopScope(
  canPop: false,
  onPopInvoked: (didPop) {
    if (!didPop) _handleBackPress();
  },
  child: ...,
)
```

---

## Testing

```dart
testWidgets('shows user name after load', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        userProfileProvider('123').overrideWith(
          () => FakeUserProfileNotifier(),
        ),
      ],
      child: const MaterialApp(home: ProfileScreen(userId: '123')),
    ),
  );

  await tester.pumpAndSettle();
  expect(find.text('Alice'), findsOneWidget);
});
```

Use `ProviderScope` overrides in tests — never mock Riverpod providers with Mockito directly.

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| `ref.watch` inside `onPressed` | Use `ref.read` in callbacks |
| `print()` left in production code | Remove or use a proper logger (`logger` package) |
| `FutureBuilder` with inline `Future` | Assign future to a field in `initState` |
| No `key` on list items that can reorder | Add `key: ValueKey(item.id)` |
| `setState` after `await` without `mounted` | Add `if (!mounted) return` guard |
| `Image.network` without cache size on tiles | Add `cacheWidth`/`cacheHeight` |
