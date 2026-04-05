# Java Patterns Skill

## When to load this skill

Load when working on a Java 21 project: Spring Boot 3.x APIs, plain Java libraries, Android backend services, or Maven-based mono-repos. Assumes Maven build tool.

---

## Project Structure (Spring Boot)

```
src/
  main/
    java/com/example/app/
      Application.java              # @SpringBootApplication entry point
      config/                       # @Configuration classes only
      domain/
        <entity>/
          <Entity>.java             # JPA entity or plain record
          <Entity>Repository.java   # Spring Data interface
      application/
        <feature>/
          <Feature>Service.java     # @Service — orchestrates use cases
          <Feature>Dto.java         # record — input/output contracts
      web/
        <feature>/
          <Feature>Controller.java  # @RestController — HTTP only, no logic
  test/
    java/com/example/app/
      <Entity>ServiceTest.java      # @ExtendWith(MockitoExtension.class)
      <Feature>ControllerTest.java  # @WebMvcTest
      <Entity>RepositoryTest.java   # @DataJpaTest
```

No business logic in controllers. No JPA entities in HTTP responses. One DTO per use case boundary.

---

## Java 21 Modern Idioms

### Records for immutable data

```java
// BAD — verbose POJO
public class UserDto {
    private final String id;
    private final String email;
    // constructor, getters, equals, hashCode, toString...
}

// GOOD
public record UserDto(String id, String email) {}
```

Use records for DTOs, value objects, and method return types. Never for JPA entities (they need a no-arg constructor and mutable fields).

### Pattern matching instanceof

```java
// BAD
if (shape instanceof Circle) {
    Circle c = (Circle) shape;
    return Math.PI * c.radius() * c.radius();
}

// GOOD
if (shape instanceof Circle c) {
    return Math.PI * c.radius() * c.radius();
}
```

### Switch expressions

```java
// BAD
String label;
switch (status) {
    case ACTIVE: label = "Active"; break;
    case INACTIVE: label = "Inactive"; break;
    default: label = "Unknown";
}

// GOOD
String label = switch (status) {
    case ACTIVE   -> "Active";
    case INACTIVE -> "Inactive";
    default       -> "Unknown";
};
```

### Sealed classes for domain discriminated unions

```java
public sealed interface PaymentResult
    permits PaymentResult.Success, PaymentResult.Failure {}

public record Success(String transactionId) implements PaymentResult {}
public record Failure(String reason, int code) implements PaymentResult {}

// Exhaustive switch — compiler enforces all cases
String message = switch (result) {
    case Success s  -> "Paid: " + s.transactionId();
    case Failure f  -> "Failed: " + f.reason();
};
```

### Virtual threads (Spring Boot 3.2+)

Enable in `application.properties`:
```properties
spring.threads.virtual.enabled=true
```

This makes Tomcat use virtual threads per request. Blocking I/O (JDBC, HTTP clients) no longer pins OS threads. No code change needed for standard `@Service` / `@Repository` beans.

For explicit virtual thread creation:
```java
Thread.ofVirtual().start(() -> heavyBlockingWork());
```

---

## Spring Boot 3.x Patterns

### Constructor injection (never field injection)

```java
// BAD
@Service
public class OrderService {
    @Autowired
    private OrderRepository repository;  // hidden dependency, breaks tests
}

// GOOD
@Service
public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }
}
```

Spring auto-wires single-constructor beans — no `@Autowired` needed.

### @Transactional — rules

```java
@Service
public class OrderService {

    // GOOD — public method, Spring proxy intercepts
    @Transactional
    public Order createOrder(OrderRequest req) { ... }

    // BAD — private method, proxy bypassed, @Transactional has no effect
    @Transactional
    private void validateOrder(OrderRequest req) { ... }

    // BAD — self-invocation, proxy bypassed
    public void process(OrderRequest req) {
        createOrder(req);  // same bean, proxy not involved
    }
}
```

For self-invocation, inject the bean itself or restructure into separate services.

### DTO — never expose entities

```java
// BAD
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
    return userRepository.findById(id).orElseThrow();  // exposes @Entity
}

// GOOD
@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) {
    return userRepository.findById(id)
        .map(UserMapper::toDto)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
}
```

### JPA — avoid N+1

```java
// BAD — triggers N+1 queries
@OneToMany(fetch = FetchType.EAGER)
private List<Order> orders;

// GOOD — lazy by default, fetch explicitly when needed
@OneToMany(fetch = FetchType.LAZY)
private List<Order> orders;

// In repository — fetch join when you know you need orders
@Query("SELECT u FROM User u LEFT JOIN FETCH u.orders WHERE u.id = :id")
Optional<User> findByIdWithOrders(@Param("id") Long id);
```

### Bean Validation

```java
// Controller
@PostMapping("/users")
public ResponseEntity<UserDto> create(
    @RequestBody @Valid CreateUserRequest req  // @Valid triggers validation
) { ... }

// DTO
public record CreateUserRequest(
    @NotBlank String name,
    @Email String email,
    @Size(min = 8) String password
) {}

// Global error handler
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
        MethodArgumentNotValidException ex
    ) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .toList();
        return ResponseEntity.badRequest().body(new ErrorResponse(errors));
    }
}
```

---

## Exception Handling

```java
// BAD — swallows exception
try {
    process(data);
} catch (Exception e) {
    e.printStackTrace();
}

// BAD — loses original cause
} catch (IOException e) {
    throw new RuntimeException("Failed to process");
}

// GOOD — preserve cause, use typed exception
} catch (IOException e) {
    throw new DataProcessingException("Failed to process file: " + path, e);
}

// GOOD — for Spring @Service, use @ResponseStatus or handle in @RestControllerAdvice
```

Define a typed exception hierarchy per domain:
```java
public class DomainException extends RuntimeException {
    public DomainException(String message, Throwable cause) {
        super(message, cause);
    }
}
public class EntityNotFoundException extends DomainException { ... }
public class DuplicateEntityException extends DomainException { ... }
```

---

## Optional — correct usage

```java
// BAD — get() without check
User user = userRepository.findById(id).get();

// BAD — Optional as a field / parameter
public void process(Optional<String> name) { ... }

// GOOD — chain operations
User user = userRepository.findById(id)
    .orElseThrow(() -> new EntityNotFoundException("User not found: " + id));

// GOOD — transform
String email = userRepository.findById(id)
    .map(User::getEmail)
    .orElse("unknown@example.com");
```

Use `Optional` only as a return type. Never as a field, constructor parameter, or method parameter.

---

## Resources — try-with-resources

```java
// BAD — connection may leak
Connection conn = dataSource.getConnection();
PreparedStatement ps = conn.prepareStatement(sql);
ResultSet rs = ps.executeQuery();
// ... if exception thrown, nothing is closed

// GOOD
try (
    Connection conn = dataSource.getConnection();
    PreparedStatement ps = conn.prepareStatement(sql);
    ResultSet rs = ps.executeQuery()
) {
    // auto-closed in reverse order on exit
}
```

Any `AutoCloseable` must be in a try-with-resources block.

---

## Concurrency

```java
// BAD — not atomic
private int count = 0;
public void increment() { count++; }  // race condition

// GOOD
private final AtomicInteger count = new AtomicInteger(0);
public void increment() { count.incrementAndGet(); }

// BAD — shared mutable map
private final Map<String, List<Event>> cache = new HashMap<>();

// GOOD
private final Map<String, List<Event>> cache = new ConcurrentHashMap<>();

// CompletableFuture — always handle failures
CompletableFuture.supplyAsync(() -> fetchData())
    .thenApply(this::transform)
    .exceptionally(ex -> {
        log.error("Pipeline failed", ex);
        return fallback();
    });
```

---

## Testing

### Unit test — @ExtendWith(MockitoExtension.class)

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository repository;
    @Mock PaymentGateway gateway;
    @InjectMocks OrderService service;

    @Test
    void createOrder_throwsWhenItemsEmpty() {
        var req = new CreateOrderRequest(List.of());
        assertThrows(InvalidOrderException.class, () -> service.createOrder(req));
        verifyNoInteractions(repository, gateway);
    }
}
```

### Controller test — @WebMvcTest (no full context)

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvc mvc;
    @MockBean OrderService service;

    @Test
    void getOrder_returns200() throws Exception {
        given(service.findById(1L)).willReturn(new OrderDto(1L, "PENDING"));

        mvc.perform(get("/orders/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("PENDING"));
    }
}
```

### Repository test — @DataJpaTest

```java
@DataJpaTest
class UserRepositoryTest {

    @Autowired UserRepository repository;

    @Test
    void findByEmail_returnsUser() {
        repository.save(new User("alice@example.com", "Alice"));
        var found = repository.findByEmail("alice@example.com");
        assertThat(found).isPresent();
    }
}
```

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| `System.out.println` in production code | Use SLF4J: `log.info(...)` |
| Raw type `List` instead of `List<String>` | Always parameterize generics |
| `new ArrayList()` instead of `List.of()` / `List.copyOf()` | Use factory methods for immutable lists |
| `@Transactional` on private method | Move to public method or separate bean |
| Returning `null` from a public method | Return `Optional<T>` or throw typed exception |
| `catch (Exception e) {}` | Log or rethrow with cause |
| EAGER fetch on collections | Use LAZY + explicit JOIN FETCH queries |
| Entity in REST response | Map to DTO/record before returning |
