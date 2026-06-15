package com.example.backend.repository;

import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.isActive = true " +
            "AND u.id != :currentUserId " +
            "AND (LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "     OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%'))) " +
            "ORDER BY u.username")
    List<User> searchUsers(@Param("query") String query, @Param("currentUserId") Long currentUserId);
}