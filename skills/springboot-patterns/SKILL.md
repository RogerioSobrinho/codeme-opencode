---
name: springboot-patterns
description: Load when writing Spring Boot code, reviewing Java PRs, or asked about Spring conventions, layering, dependency injection, transactions, or JPA patterns.
---

# Spring Boot Patterns

## Architecture

```
controller/    # HTTP layer — request parsing, response shaping, no business logic
service/       # Business logic, @Transactional lives here
repository/    # Database access — Spring Data JPA interfaces
dto/           # Data Transfer Objects — records for immutability
entity/        # JPA entities — never exposed in REST responses
exception/     # Custom exception hierarchy + @ControllerAdvice
config/        # Spring configuration classes
```

**Rule:** controller → service → repository. Never skip layers. Never put `@Transactional` on controllers or repositories.

## Dependency Injection — Constructor Only

```java
// GOOD — constructor injection, final fields, no @Autowired
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final UserService userService;

    public OrderService(OrderRepository orderRepository, UserService userService) {
        this.orderRepository = orderRepository;
        this.userService = userService;
    }
}

// BAD — field injection, non-final, hidden dependencies
@Service
public class OrderService {
    @Autowired private OrderRepository orderRepository; // never
}
```

## Transaction Rules

```java
// GOOD — @Transactional on service methods
@Service
public class UserService {
    @Transactional(readOnly = true)   // for reads — uses read replica, no lock
    public UserDto findById(Long id) {
        return userRepository.findById(id)
            .map(UserDto::from)
            .orElseThrow(() -> new NotFoundException("User", id));
    }

    @Transactional                    // for writes
    public UserDto create(CreateUserRequest req) {
        var user = new User(req.name(), req.email());
        return UserDto.from(userRepository.save(user));
    }
}
```

## JPA Patterns

```java
// Entity — never expose directly in REST responses
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // LAZY for collections — prevents N+1 on simple queries
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private List<Order> orders = new ArrayList<>();
}

// DTO as record — immutable, no JPA contamination
public record UserDto(Long id, String name, String email) {
    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getName(), user.getEmail());
    }
}

// Avoid Optional.get() without checking
// BAD
User user = userRepository.findById(id).get(); // NoSuchElementException

// GOOD
User user = userRepository.findById(id)
    .orElseThrow(() -> new NotFoundException("User", id));
```

## Error Handling

```java
// Custom exception hierarchy
public class AppException extends RuntimeException {
    private final int status;
    public AppException(String message, int status) {
        super(message);
        this.status = status;
    }
    public int getStatus() { return status; }
}

public class NotFoundException extends AppException {
    public NotFoundException(String resource, Object id) {
        super(resource + " not found: " + id, 404);
    }
}

// Global handler — one place for all error responses
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ErrorResponse> handle(AppException ex) {
        return ResponseEntity.status(ex.getStatus())
            .body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(new ErrorResponse(msg));
    }
}
```

## Security

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;

    // Constructor injection — not field injection
    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/auth/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `@Autowired` on fields | Hidden dependencies, can't test without Spring | Constructor injection |
| `@Transactional` on controller | Transaction too wide, HTTP concerns mixed | Service layer only |
| Returning entity from REST endpoint | Exposes internal model, cycles, LazyInit exception | Map to DTO |
| `FetchType.EAGER` on collections | N+1 queries, loads everything unconditionally | `LAZY` + explicit join fetch when needed |
| Business logic in controller | Untestable without HTTP layer | Move to service |
| Swallowing exceptions silently | Silent failures, impossible to diagnose | Let `@ControllerAdvice` handle |
